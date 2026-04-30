import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";
import { recordSignedRepresentationEngagementRow } from "../engagements";
import {
	buildEligiblePlatformLawyerProfileFixture,
	buildEligiblePlatformLsoLawyerFixture,
	buildRestrictedLsoLawyerFixture,
} from "../fixtures";
import { evaluateDealLegalGate } from "../gates";
import { normalizeLawyerEmail } from "../normalization";
import { buildManualLawyerVerificationResult } from "../providers";
import { recordLawyerVerificationRow } from "../verifications";

const NOW = 1_770_000_000_000;
const LAWYER_AUTH_ID = "lawyer-auth";
type TestMutationCtx = Pick<MutationCtx, "db">;

async function seedDealScaffold(
	ctx: TestMutationCtx,
	args?: {
		readonly accessStatus?: "active" | "revoked";
		readonly lawyerAuthId?: string;
		readonly platformStatus?: Doc<"lawyerProfiles">["platformStatus"];
		readonly selectedLawyer?: Doc<"deals">["selectedLawyer"];
	}
) {
	const lawyerAuthId = args?.lawyerAuthId ?? LAWYER_AUTH_ID;
	const userId = await ctx.db.insert("users", {
		authId: "seed-broker",
		email: "broker@example.test",
		firstName: "Seed",
		lastName: "Broker",
	});
	const propertyId = await ctx.db.insert("properties", {
		city: "Toronto",
		createdAt: NOW,
		postalCode: "M5V 1A1",
		propertyType: "residential",
		province: "ON",
		streetAddress: "123 Gate Contract St",
	});
	const brokerId = await ctx.db.insert("brokers", {
		createdAt: NOW,
		status: "active",
		userId,
	});
	const mortgageId = await ctx.db.insert("mortgages", {
		amortizationMonths: 300,
		brokerOfRecordId: brokerId,
		createdAt: NOW,
		firstPaymentDate: "2026-02-01",
		interestAdjustmentDate: "2026-01-01",
		interestRate: 9.5,
		lienPosition: 1,
		loanType: "conventional",
		maturityDate: "2031-01-01",
		paymentAmount: 2500,
		paymentFrequency: "monthly",
		principal: 500_000,
		propertyId,
		rateType: "fixed",
		status: "funded",
		termMonths: 60,
		termStartDate: "2026-01-01",
	});
	const lsoLawyerId = await ctx.db.insert(
		"lsoLawyers",
		buildEligiblePlatformLsoLawyerFixture({ now: NOW })
	);
	const profileId = await ctx.db.insert("lawyerProfiles", {
		...buildEligiblePlatformLawyerProfileFixture({
			lawyerAuthId,
			now: NOW,
		}),
		platformStatus: args?.platformStatus ?? "active",
	});
	const selectedLawyer = args?.selectedLawyer ?? {
		type: "platform_lawyer" as const,
		lawyerId: lawyerAuthId,
		name: "Avery Chen",
		email: "avery.chen@example.test",
		firm: "FairLend Panel Law",
		lso: {
			barNumber: "LSO123456",
			jurisdiction: "ON",
			licensingStatus: "licensed" as const,
			restrictionStatus: "clear" as const,
			lsoLawyerId,
			source: "test_fixture",
			sourceFetchedAt: NOW,
		},
	};
	const dealId = await ctx.db.insert("deals", {
		buyerId: "buyer-auth",
		createdAt: NOW,
		createdBy: "system:test",
		fractionalShare: 10,
		lawyerId: lawyerAuthId,
		lawyerType: selectedLawyer.type,
		mortgageId,
		selectedLawyer,
		sellerId: "seller-auth",
		status: "lawyerOnboarding.verified",
	});
	await ctx.db.insert("dealAccess", {
		dealId,
		grantedAt: NOW,
		grantedBy: "system:test",
		revokedAt: args?.accessStatus === "revoked" ? NOW + 1 : undefined,
		role: selectedLawyer.type,
		status: args?.accessStatus ?? "active",
		userId: lawyerAuthId,
	});
	return { dealId, lawyerAuthId, lsoLawyerId, profileId };
}

async function recordVerification(
	ctx: TestMutationCtx,
	args: {
		readonly dealId: Id<"deals">;
		readonly expiresAt?: number;
		readonly lawyerAuthId?: string;
		readonly lsoLawyerId: Id<"lsoLawyers">;
		readonly outcome?: "eligible" | "ineligible";
		readonly profileId: Id<"lawyerProfiles">;
	}
) {
	const restricted =
		args.outcome === "ineligible"
			? buildRestrictedLsoLawyerFixture({ now: NOW })
			: null;
	return await recordLawyerVerificationRow(ctx, {
		authId: args.lawyerAuthId ?? LAWYER_AUTH_ID,
		barNumber: restricted?.barNumber ?? "LSO123456",
		checkType: "initial_lso",
		createdAt: NOW,
		createdBy: "system:test",
		dealId: args.dealId,
		jurisdiction: "ON",
		lawyerProfileId: args.profileId,
		lsoLawyerId: args.lsoLawyerId,
		normalizedEmail: normalizeLawyerEmail("avery.chen@example.test"),
		providerResult: buildManualLawyerVerificationResult({
			evidenceHash: `gate-verification:${args.outcome ?? "eligible"}:${args.expiresAt ?? "none"}`,
			expiresAt:
				args.outcome === "ineligible"
					? undefined
					: (args.expiresAt ?? NOW + 1000),
			outcome: args.outcome ?? "eligible",
			reasonCodes:
				args.outcome === "ineligible"
					? ["license_restricted"]
					: ["active_license"],
			sourceSnapshot: { source: "gate-test" },
		}),
	});
}

describe("deal legal representation gates", () => {
	it("blocks LAWYER_VERIFIED without a selected lawyer", async () => {
		const t = convexTest(schema, convexModules);
		const result = await t.run(async (ctx) => {
			const seeded = await seedDealScaffold(ctx, {
				selectedLawyer: undefined,
			});
			const deal = await ctx.db.get(seeded.dealId);
			if (!deal) {
				throw new Error("seeded deal missing");
			}
			return evaluateDealLegalGate(ctx, {
				checkpoint: "LAWYER_VERIFIED",
				deal: { ...deal, lawyerId: undefined, selectedLawyer: undefined },
				now: NOW,
			});
		});

		expect(result).toMatchObject({
			decision: "block",
			reasonCodes: ["selected_lawyer_missing"],
		});
	});

	it("allows LAWYER_VERIFIED with selected lawyer and current eligible evidence", async () => {
		const t = convexTest(schema, convexModules);
		const result = await t.run(async (ctx) => {
			const seeded = await seedDealScaffold(ctx);
			await recordVerification(ctx, seeded);
			const deal = await ctx.db.get(seeded.dealId);
			if (!deal) {
				throw new Error("seeded deal missing");
			}
			return evaluateDealLegalGate(ctx, {
				checkpoint: "LAWYER_VERIFIED",
				deal,
				now: NOW,
			});
		});

		expect(result).toMatchObject({
			decision: "allow",
			lawyerAuthId: LAWYER_AUTH_ID,
			reasonCodes: ["active_license"],
		});
		expect(result.verificationId).toBeTruthy();
	});

	it("blocks stale or ineligible verification evidence", async () => {
		const t = convexTest(schema, convexModules);
		const result = await t.run(async (ctx) => {
			const stale = await seedDealScaffold(ctx, {
				lawyerAuthId: "stale-lawyer",
			});
			await recordVerification(ctx, {
				...stale,
				expiresAt: NOW - 1,
			});
			const restricted = await seedDealScaffold(ctx, {
				lawyerAuthId: "restricted-lawyer",
			});
			await recordVerification(ctx, {
				...restricted,
				lawyerAuthId: "restricted-lawyer",
				outcome: "ineligible",
			});
			const staleDeal = await ctx.db.get(stale.dealId);
			const restrictedDeal = await ctx.db.get(restricted.dealId);
			if (!(staleDeal && restrictedDeal)) {
				throw new Error("seeded deals missing");
			}
			return {
				stale: await evaluateDealLegalGate(ctx, {
					checkpoint: "LAWYER_VERIFIED",
					deal: staleDeal,
					now: NOW,
				}),
				restricted: await evaluateDealLegalGate(ctx, {
					checkpoint: "LAWYER_VERIFIED",
					deal: restrictedDeal,
					now: NOW,
				}),
			};
		});

		expect(result.stale).toMatchObject({
			decision: "block",
			reasonCodes: ["evidence_expired"],
		});
		expect(result.restricted).toMatchObject({
			decision: "block",
			reasonCodes: ["license_restricted"],
		});
	});

	it("blocks representation confirmation without active access or engagement evidence", async () => {
		const t = convexTest(schema, convexModules);
		const result = await t.run(async (ctx) => {
			const missingAccess = await seedDealScaffold(ctx, {
				accessStatus: "revoked",
				lawyerAuthId: "revoked-lawyer",
			});
			await recordVerification(ctx, {
				...missingAccess,
				lawyerAuthId: "revoked-lawyer",
			});
			const missingEngagement = await seedDealScaffold(ctx, {
				lawyerAuthId: "no-engagement-lawyer",
			});
			await recordVerification(ctx, {
				...missingEngagement,
				lawyerAuthId: "no-engagement-lawyer",
			});
			const missingAccessDeal = await ctx.db.get(missingAccess.dealId);
			const missingEngagementDeal = await ctx.db.get(missingEngagement.dealId);
			if (!(missingAccessDeal && missingEngagementDeal)) {
				throw new Error("seeded deals missing");
			}
			return {
				missingAccess: await evaluateDealLegalGate(ctx, {
					access: {
						requireActiveAccess: true,
						sourceActorId: "revoked-lawyer",
					},
					checkpoint: "REPRESENTATION_CONFIRMED",
					deal: missingAccessDeal,
					now: NOW,
				}),
				missingEngagement: await evaluateDealLegalGate(ctx, {
					access: {
						requireActiveAccess: true,
						sourceActorId: "no-engagement-lawyer",
					},
					checkpoint: "REPRESENTATION_CONFIRMED",
					deal: missingEngagementDeal,
					now: NOW,
				}),
			};
		});

		expect(result.missingAccess).toMatchObject({
			decision: "block",
			reasonCodes: ["lawyer_access_missing"],
		});
		expect(result.missingEngagement).toMatchObject({
			decision: "block",
			reasonCodes: ["engagement_missing"],
		});
	});

	it("allows representation confirmation only for the selected lawyer with signed engagement evidence", async () => {
		const t = convexTest(schema, convexModules);
		const result = await t.run(async (ctx) => {
			const seeded = await seedDealScaffold(ctx);
			await recordVerification(ctx, seeded);
			const engagementId = await recordSignedRepresentationEngagementRow(ctx, {
				dealId: seeded.dealId,
				evidenceHash: "sha256:engagement-gate-test",
				lawyerAuthId: seeded.lawyerAuthId,
				lawyerProfileId: seeded.profileId,
				signedAt: NOW,
			});
			const deal = await ctx.db.get(seeded.dealId);
			if (!deal) {
				throw new Error("seeded deal missing");
			}
			return {
				allowed: await evaluateDealLegalGate(ctx, {
					access: {
						requireActiveAccess: true,
						sourceActorId: seeded.lawyerAuthId,
					},
					checkpoint: "REPRESENTATION_CONFIRMED",
					deal,
					now: NOW,
				}),
				engagementId,
				wrongLawyer: await evaluateDealLegalGate(ctx, {
					access: {
						requireActiveAccess: true,
						sourceActorId: "wrong-lawyer",
					},
					checkpoint: "REPRESENTATION_CONFIRMED",
					deal,
					now: NOW,
				}),
			};
		});

		expect(result.allowed).toMatchObject({
			decision: "allow",
			engagementId: result.engagementId,
			reasonCodes: ["active_license", "engagement_signed"],
		});
		expect(result.wrongLawyer).toMatchObject({
			decision: "block",
			reasonCodes: ["selected_lawyer_mismatch"],
		});
	});

	it("uses the same signed engagement gate for guest lawyers", async () => {
		const t = convexTest(schema, convexModules);
		const result = await t.run(async (ctx) => {
			const guestAuthId = "gail.guest@example.test";
			const seeded = await seedDealScaffold(ctx, {
				lawyerAuthId: guestAuthId,
				selectedLawyer: {
					type: "guest_lawyer",
					source: "manual",
					name: "Gail Guest",
					email: "Gail.Guest@Example.TEST",
					firm: "Guest Law LLP",
				},
			});
			await recordVerification(ctx, {
				...seeded,
				lawyerAuthId: guestAuthId,
			});
			await recordSignedRepresentationEngagementRow(ctx, {
				dealId: seeded.dealId,
				evidenceHash: "sha256:guest-engagement-gate-test",
				lawyerAuthId: guestAuthId,
				lawyerProfileId: seeded.profileId,
				signedAt: NOW,
			});
			const deal = await ctx.db.get(seeded.dealId);
			if (!deal) {
				throw new Error("seeded deal missing");
			}
			return evaluateDealLegalGate(ctx, {
				access: {
					requireActiveAccess: true,
					sourceActorId: guestAuthId,
				},
				checkpoint: "REPRESENTATION_CONFIRMED",
				deal,
				now: NOW,
			});
		});

		expect(result).toMatchObject({
			decision: "allow",
			engagementId: expect.any(String),
			reasonCodes: ["active_license", "engagement_signed"],
		});
	});
});
