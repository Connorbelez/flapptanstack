import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "../../_generated/api";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";
import { projectPlatformLawyerAvailability } from "../availability";
import { buildEligiblePlatformLawyerProfileFixture } from "../fixtures";
import {
	assertPlatformLawyerSelectableForCheckout,
	listPlatformLawyerCheckoutOptions,
} from "../platformLawyers";
import { buildManualLawyerVerificationResult } from "../providers";
import { recordLawyerVerificationRow } from "../verifications";

const NOW = Date.parse("2026-05-01T14:00:00.000Z");
const CHECKOUT_SELECTION_ERROR = /not eligible for new checkout selection/i;

async function seedPlatformLawyer(
	t: ReturnType<typeof convexTest>,
	options?: { capacityLimit?: number; recheckAt?: number }
) {
	return await t.run(async (ctx) => {
		const profileFixture = buildEligiblePlatformLawyerProfileFixture({
			lawyerAuthId: "user_platform_lawyer",
			now: NOW,
		});
		await ctx.db.insert("users", {
			authId: "user_platform_lawyer",
			email: profileFixture.email,
			firstName: "Avery",
			lastName: "Chen",
		});
		await ctx.db.insert("organizationMemberships", {
			organizationName: "Seed Law Firm",
			organizationWorkosId: "org_seed_lawfirm",
			roleSlug: "platform_lawyer",
			roleSlugs: ["platform_lawyer"],
			status: "active",
			userWorkosId: "user_platform_lawyer",
			workosId: "om_seed_user_platform_lawyer",
		});
		const profileId = await ctx.db.insert("lawyerProfiles", {
			...profileFixture,
		});
		const verificationId = await recordLawyerVerificationRow(ctx, {
			authId: profileFixture.authId,
			barNumber: profileFixture.barNumber,
			checkType: "manual_admin",
			createdAt: NOW,
			createdBy: "system:test",
			jurisdiction: profileFixture.jurisdiction,
			lawyerProfileId: profileId,
			normalizedEmail: profileFixture.normalizedEmail,
			providerResult: buildManualLawyerVerificationResult({
				evidenceHash: `test-platform-lawyer:${String(profileId)}`,
				expiresAt: NOW + 90 * 86_400_000,
				outcome: "eligible",
				reasonCodes: ["manual_override"],
			}),
		});
		await ctx.db.patch(profileId, { latestVerificationId: verificationId });
		const tierId = await ctx.db.insert("platformLawyerSlaTiers", {
			name: "24h review",
			reviewHours: 24,
			status: "active",
			createdAt: NOW,
			createdBy: "system:test",
			updatedAt: NOW,
			updatedBy: "system:test",
		});
		await ctx.db.insert("platformLawyerAssignments", {
			lawyerProfileId: profileId,
			slaTierId: tierId,
			capacityLimit: options?.capacityLimit ?? 1,
			recheckIntervalDays: 30,
			nextRestrictionRecheckAt: options?.recheckAt ?? NOW + 30 * 86_400_000,
			createdAt: NOW,
			createdBy: "system:test",
			updatedAt: NOW,
			updatedBy: "system:test",
		});
		return { profileId, tierId };
	});
}

async function seedMortgage(t: ReturnType<typeof convexTest>) {
	return await t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {
			authId: "broker-auth",
			email: "broker@example.test",
			firstName: "Broker",
			lastName: "Test",
		});
		const brokerId = await ctx.db.insert("brokers", {
			userId,
			status: "active",
			createdAt: NOW,
		});
		const propertyId = await ctx.db.insert("properties", {
			streetAddress: "1 Legal Ops Way",
			city: "Toronto",
			province: "ON",
			postalCode: "M5V 1A1",
			propertyType: "residential",
			createdAt: NOW,
		});
		return await ctx.db.insert("mortgages", {
			status: "active",
			propertyId,
			principal: 500_000,
			interestRate: 9.5,
			rateType: "fixed",
			termMonths: 12,
			amortizationMonths: 300,
			paymentAmount: 4200,
			paymentFrequency: "monthly",
			loanType: "conventional",
			lienPosition: 1,
			interestAdjustmentDate: "2026-01-01",
			termStartDate: "2026-01-01",
			maturityDate: "2027-01-01",
			firstPaymentDate: "2026-02-01",
			brokerOfRecordId: brokerId,
			createdAt: NOW,
		});
	});
}

describe("platform lawyer availability and SLA operations", () => {
	it("projects weekly availability with dated hold exceptions", async () => {
		const t = convexTest(schema, convexModules);
		const { profileId } = await seedPlatformLawyer(t);
		const projection = await t.run(async (ctx) => {
			await ctx.db.insert("platformLawyerAvailabilityWindows", {
				lawyerProfileId: profileId,
				dayOfWeek: 1,
				startMinute: 9 * 60,
				endMinute: 12 * 60,
				timezone: "America/Toronto",
				status: "active",
				createdAt: NOW,
				createdBy: "system:test",
				updatedAt: NOW,
				updatedBy: "system:test",
			});
			await ctx.db.insert("platformLawyerAvailabilityExceptions", {
				lawyerProfileId: profileId,
				businessDate: "2026-05-01",
				kind: "hold",
				reason: "court",
				createdAt: NOW,
				createdBy: "system:test",
				updatedAt: NOW,
				updatedBy: "system:test",
			});
			return await projectPlatformLawyerAvailability(ctx, {
				lawyerProfileId: profileId,
				now: NOW,
				days: 2,
			});
		});

		expect(projection[0]).toMatchObject({
			businessDate: "2026-05-01",
			hasAvailability: false,
			isOnHold: true,
		});
		expect(projection[1]).toMatchObject({
			businessDate: "2026-05-04",
			hasAvailability: true,
			windows: ["09:00-12:00"],
		});
	});

	it("excludes over-capacity platform lawyers from checkout options", async () => {
		const t = convexTest(schema, convexModules);
		await seedPlatformLawyer(t, { capacityLimit: 1 });
		const mortgageId = await seedMortgage(t);
		const options = await t.run(async (ctx) => {
			await ctx.db.insert("deals", {
				status: "documentReview.pending",
				mortgageId,
				buyerId: "buyer",
				sellerId: "seller",
				fractionalShare: 10,
				lawyerId: "user_platform_lawyer",
				lawyerType: "platform_lawyer",
				createdAt: NOW,
				createdBy: "system:test",
			});
			await ctx.db.insert("deals", {
				status: "documentReview.signed",
				mortgageId,
				buyerId: "buyer2",
				sellerId: "seller",
				fractionalShare: 10,
				lawyerId: "user_platform_lawyer",
				lawyerType: "platform_lawyer",
				createdAt: NOW,
				createdBy: "system:test",
			});
			return await listPlatformLawyerCheckoutOptions(ctx, { now: NOW });
		});

		expect(options).toEqual([]);
	});

	it("rejects direct checkout selection for a full platform lawyer", async () => {
		const t = convexTest(schema, convexModules);
		await seedPlatformLawyer(t, { capacityLimit: 1 });
		const mortgageId = await seedMortgage(t);

		await expect(
			t.run(async (ctx) => {
				await ctx.db.insert("deals", {
					status: "documentReview.pending",
					mortgageId,
					buyerId: "buyer",
					sellerId: "seller",
					fractionalShare: 10,
					lawyerId: "user_platform_lawyer",
					lawyerType: "platform_lawyer",
					createdAt: NOW,
					createdBy: "system:test",
				});
				await assertPlatformLawyerSelectableForCheckout(ctx, {
					lawyerAuthId: "user_platform_lawyer",
					now: NOW,
				});
			})
		).rejects.toThrow(CHECKOUT_SELECTION_ERROR);
	});

	it("creates exactly one SLA breach escalation across retries", async () => {
		const t = convexTest(schema, convexModules);
		const { profileId, tierId } = await seedPlatformLawyer(t);
		const mortgageId = await seedMortgage(t);
		await t.run(async (ctx) => {
			const dealId = await ctx.db.insert("deals", {
				status: "documentReview.pending",
				mortgageId,
				buyerId: "buyer",
				sellerId: "seller",
				fractionalShare: 10,
				lawyerId: "user_platform_lawyer",
				lawyerType: "platform_lawyer",
				createdAt: NOW,
				createdBy: "system:test",
			});
			await ctx.db.insert("platformLawyerSlaReviews", {
				lawyerProfileId: profileId,
				dealId,
				slaTierId: tierId,
				status: "active",
				startedAt: NOW - 48 * 3_600_000,
				dueAt: NOW - 24 * 3_600_000,
				idempotencyKey: "sla-review:test",
				createdAt: NOW,
				updatedAt: NOW,
			});
		});

		await t.mutation(internal.legalRepresentation.sla.checkSlaBreaches, {
			now: NOW,
		});
		await t.mutation(internal.legalRepresentation.sla.checkSlaBreaches, {
			now: NOW,
		});

		const escalations = await t.run(
			async (ctx) => await ctx.db.query("platformLawyerEscalations").collect()
		);
		expect(escalations).toHaveLength(1);
		expect(escalations[0]).toMatchObject({ kind: "sla_breach" });
	});

	it("periodic restriction recheck writes one evidence row and suspends restricted lawyers", async () => {
		const t = convexTest(schema, convexModules);
		const { profileId } = await seedPlatformLawyer(t, { recheckAt: NOW - 1 });
		await t.run(async (ctx) => {
			await ctx.db.insert("lsoLawyers", {
				normalizedName: "avery chen",
				displayName: "Avery Chen",
				barNumber: "LSO123456",
				jurisdiction: "ON",
				licensingStatus: "licensed",
				restrictionStatus: "restricted",
				source: "test",
				sourceSnapshot: { provider: "test" },
				sourceFetchedAt: NOW,
				updatedAt: NOW,
			});
		});

		await t.mutation(
			internal.legalRepresentation.sla.runPeriodicRestrictionRechecks,
			{ now: NOW }
		);
		await t.mutation(
			internal.legalRepresentation.sla.runPeriodicRestrictionRechecks,
			{ now: NOW }
		);

		const result = await t.run(async (ctx) => ({
			profile: await ctx.db.get(profileId),
			verifications: await ctx.db.query("lawyerVerifications").collect(),
			escalations: await ctx.db.query("platformLawyerEscalations").collect(),
		}));
		expect(result.profile?.platformStatus).toBe("suspended");
		const periodicVerifications = result.verifications.filter(
			(row) => row.checkType === "platform_periodic"
		);
		expect(periodicVerifications).toHaveLength(1);
		expect(periodicVerifications[0]).toMatchObject({
			checkType: "platform_periodic",
			outcome: "ineligible",
		});
		expect(
			result.escalations.some((row) => row.kind === "restriction_recheck")
		).toBe(true);
	});
});
