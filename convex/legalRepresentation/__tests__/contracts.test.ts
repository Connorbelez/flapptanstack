import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";
import {
	buildEligiblePlatformLawyerProfileFixture,
	buildEligiblePlatformLsoLawyerFixture,
	buildExpiredInvitationFixture,
	buildNewGuestLawyerInvitationFixture,
	buildRestrictedLsoLawyerFixture,
	buildSignedEngagementEvidenceFixture,
} from "../fixtures";
import {
	normalizeBarNumber,
	normalizeJurisdiction,
	normalizeLawyerEmail,
	normalizeLawyerName,
	normalizeReasonCodes,
} from "../normalization";
import {
	buildManualLawyerVerificationResult,
	DeterministicLawyerVerificationProvider,
	normalizeLawyerIdentity,
} from "../providers";
import {
	decideLegalCheckpoint,
	getLatestLawyerVerificationForAuth,
	getLatestLawyerVerificationForBar,
	getLatestLawyerVerificationForProfile,
	isEligibleCurrentLawyerVerification,
	listExpiringLawyerVerifications,
	listLawyerVerificationsForDeal,
	recordLawyerVerificationRow,
	verificationBlocksCheckpoint,
} from "../verifications";

const NOW = 1_770_000_000_000;

function asVerification(
	overrides: Partial<Doc<"lawyerVerifications">>
): Doc<"lawyerVerifications"> {
	return {
		_id: "verification_test" as Id<"lawyerVerifications">,
		_creationTime: NOW,
		checkType: "initial_lso",
		createdAt: NOW,
		createdBy: "system:test",
		outcome: "eligible",
		provider: "test",
		providerStatus: "completed",
		reasonCodes: ["active_license"],
		sourceSnapshot: { provider: "test" },
		...overrides,
	};
}

describe("legal representation normalization", () => {
	it("normalizes identity fields deterministically", () => {
		expect(normalizeLawyerName("  Pat   Lawyer ")).toBe("pat lawyer");
		expect(normalizeLawyerEmail(" Pat@Example.COM ")).toBe("pat@example.com");
		expect(normalizeBarNumber(" lso-123 456 ")).toBe("LSO123456");
		expect(normalizeJurisdiction(" on ")).toBe("ON");
		expect(normalizeReasonCodes(["active_license", "active_license"])).toEqual([
			"active_license",
		]);
	});
});

describe("legal representation providers", () => {
	it("returns eligible evidence for clear licensed LSO references", async () => {
		const provider = new DeterministicLawyerVerificationProvider("test");
		const result = await provider.verify({
			checkType: "initial_lso",
			identity: normalizeLawyerIdentity({
				displayName: "Avery Chen",
				email: "avery@example.test",
				barNumber: "LSO-123",
				jurisdiction: "on",
			}),
			lsoReference: buildEligiblePlatformLsoLawyerFixture({ now: NOW }),
			requestedAt: NOW,
			requestedBy: "system:test",
		});

		expect(result).toMatchObject({
			outcome: "eligible",
			provider: "test",
			reasonCodes: ["active_license"],
		});
		expect(result.expiresAt).toBeGreaterThan(NOW);
	});

	it("returns ineligible evidence for restricted LSO references", async () => {
		const provider = new DeterministicLawyerVerificationProvider("test");
		const result = await provider.verify({
			checkType: "fresh_restriction",
			identity: normalizeLawyerIdentity({
				displayName: "Jordan Restricted",
				email: "restricted@example.test",
				barNumber: "LSO-999",
				jurisdiction: "ON",
			}),
			lsoReference: buildRestrictedLsoLawyerFixture({ now: NOW }),
			requestedAt: NOW,
			requestedBy: "system:test",
		});

		expect(result.outcome).toBe("ineligible");
		expect(result.reasonCodes).toContain("license_restricted");
	});

	it("returns suspended evidence for suspended restriction statuses", async () => {
		const provider = new DeterministicLawyerVerificationProvider("test");
		const result = await provider.verify({
			checkType: "fresh_restriction",
			identity: normalizeLawyerIdentity({
				displayName: "Sam Suspended",
				email: "suspended@example.test",
				barNumber: "LSO-777",
				jurisdiction: "ON",
			}),
			lsoReference: {
				...buildEligiblePlatformLsoLawyerFixture({ now: NOW }),
				restrictionStatus: "suspended",
			},
			requestedAt: NOW,
			requestedBy: "system:test",
		});

		expect(result).toMatchObject({
			outcome: "ineligible",
			reasonCodes: ["license_suspended"],
		});
	});
});

describe("legal checkpoint decisions", () => {
	it("allows current eligible evidence for LAWYER_VERIFIED", () => {
		const verification = asVerification({ expiresAt: NOW + 1 });

		expect(
			decideLegalCheckpoint({
				checkpoint: "LAWYER_VERIFIED",
				now: NOW,
				verification,
			})
		).toMatchObject({
			decision: "allow",
			reasonCodes: ["active_license"],
		});
	});

	it("blocks stale evidence at legal checkpoints", () => {
		const verification = asVerification({ expiresAt: NOW - 1 });

		expect(
			verificationBlocksCheckpoint({
				checkpoint: "LAWYER_VERIFIED",
				now: NOW,
				verification,
			})
		).toBe(true);
		expect(
			decideLegalCheckpoint({
				checkpoint: "LAWYER_VERIFIED",
				now: NOW,
				verification,
			}).reasonCodes
		).toEqual(["evidence_expired"]);
	});

	it("does not treat eligible evidence without expiry as current", () => {
		const verification = asVerification({ expiresAt: undefined });

		expect(isEligibleCurrentLawyerVerification(verification, NOW)).toBe(false);
		expect(
			verificationBlocksCheckpoint({
				checkpoint: "LAWYER_VERIFIED",
				now: NOW,
				verification,
			})
		).toBe(true);
	});

	it("requires signed engagement evidence for representation confirmation", () => {
		const verification = asVerification({ expiresAt: NOW + 1 });

		expect(
			decideLegalCheckpoint({
				checkpoint: "REPRESENTATION_CONFIRMED",
				now: NOW,
				verification,
			})
		).toMatchObject({
			decision: "block",
			reasonCodes: ["engagement_missing"],
		});

		expect(
			decideLegalCheckpoint({
				checkpoint: "REPRESENTATION_CONFIRMED",
				engagement: {
					_id: "engagement_test" as Id<"representationEngagements">,
					status: "signed",
				},
				now: NOW,
				verification,
			})
		).toMatchObject({
			decision: "allow",
			reasonCodes: ["active_license", "engagement_signed"],
		});
	});

	it("blocks suspended platform profiles from platform activation", () => {
		expect(
			decideLegalCheckpoint({
				checkpoint: "platform_activation",
				now: NOW,
				profile: { platformStatus: "suspended" },
				verification: asVerification({ expiresAt: NOW + 1 }),
			})
		).toMatchObject({
			decision: "block",
			reasonCodes: ["profile_suspended"],
		});
	});
});

describe("legal representation Convex contracts", () => {
	it("stores immutable verification rows and reads normalized latest rows by downstream lookup keys", async () => {
		const t = convexTest(schema, convexModules);
		const result = await t.run(async (ctx) => {
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
				streetAddress: "123 Legal Contract St",
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
				interestRate: 9.5,
				interestAdjustmentDate: "2026-01-01",
				lienPosition: 1,
				loanType: "conventional",
				maturityDate: "2031-01-01",
				paymentAmount: 2500,
				paymentFrequency: "monthly",
				principal: 500_000,
				propertyId,
				rateType: "fixed",
				firstPaymentDate: "2026-02-01",
				status: "funded",
				termMonths: 60,
				termStartDate: "2026-01-01",
			});
			const dealId = await ctx.db.insert("deals", {
				buyerId: "buyer-auth",
				createdAt: NOW,
				createdBy: "system:test",
				fractionalShare: 10,
				mortgageId,
				sellerId: "seller-auth",
				status: "lawyerOnboarding.pending",
			});
			const lsoLawyerId = await ctx.db.insert(
				"lsoLawyers",
				buildEligiblePlatformLsoLawyerFixture({ now: NOW })
			);
			const profileId = await ctx.db.insert(
				"lawyerProfiles",
				buildEligiblePlatformLawyerProfileFixture({ now: NOW })
			);
			const providerResult = buildManualLawyerVerificationResult({
				expiresAt: NOW + 1000,
				outcome: "eligible",
				reasonCodes: ["active_license"],
				sourceSnapshot: { source: "manual-contract-test" },
			});
			await recordLawyerVerificationRow(ctx, {
				authId: "user_lawyer_platform",
				barNumber: "LSO123456",
				checkType: "initial_lso",
				createdAt: NOW,
				createdBy: "system:test",
				dealId,
				jurisdiction: "ON",
				lawyerProfileId: profileId,
				lsoLawyerId,
				normalizedEmail: "avery.chen@example.test",
				providerResult,
			});
			const verificationId = await recordLawyerVerificationRow(ctx, {
				authId: "user_lawyer_platform",
				barNumber: " lso-123 456 ",
				checkType: "initial_lso",
				createdAt: NOW + 1,
				createdBy: "system:test",
				dealId,
				jurisdiction: " on ",
				lawyerProfileId: profileId,
				lsoLawyerId,
				normalizedEmail: " Avery.Chen@Example.TEST ",
				providerResult: {
					...providerResult,
					expiresAt: NOW + 2000,
				},
			});

			return {
				byAuth: await getLatestLawyerVerificationForAuth(ctx, {
					authId: "user_lawyer_platform",
					checkType: "initial_lso",
				}),
				byBar: await getLatestLawyerVerificationForBar(ctx, {
					barNumber: "LSO123456",
					checkType: "initial_lso",
					jurisdiction: "ON",
				}),
				byDeal: await listLawyerVerificationsForDeal(ctx, { dealId }),
				byDealCheck: await listLawyerVerificationsForDeal(ctx, {
					checkType: "initial_lso",
					dealId,
				}),
				byProfile: await getLatestLawyerVerificationForProfile(ctx, {
					checkType: "initial_lso",
					lawyerProfileId: profileId,
				}),
				expiring: await listExpiringLawyerVerifications(ctx, {
					checkType: "initial_lso",
					expiresAtOrBefore: NOW + 1500,
				}),
				verificationId,
			};
		});

		expect(result.byAuth?._id).toBe(result.verificationId);
		expect(result.byBar?._id).toBe(result.verificationId);
		expect(result.byDeal.map((row) => row._id)).toEqual([
			result.verificationId,
			result.expiring[0]?._id,
		]);
		expect(result.byDealCheck.map((row) => row._id)).toEqual(
			result.byDeal.map((row) => row._id)
		);
		expect(result.byProfile?._id).toBe(result.verificationId);
		expect(result.expiring).toHaveLength(1);
		expect(isEligibleCurrentLawyerVerification(result.byAuth, NOW)).toBe(true);
	});

	it("rejects persisted eligible evidence without expiry", async () => {
		const t = convexTest(schema, convexModules);

		await expect(
			t.run(async (ctx) =>
				recordLawyerVerificationRow(ctx, {
					checkType: "manual_admin",
					createdBy: "system:test",
					providerResult: buildManualLawyerVerificationResult({
						outcome: "eligible",
						reasonCodes: ["manual_override"],
					}),
				})
			)
		).rejects.toThrow("Eligible lawyer verification requires expiresAt");
	});

	it("provides invitation and engagement fixtures with expected lifecycle states", () => {
		expect(buildNewGuestLawyerInvitationFixture({ now: NOW })).toMatchObject({
			status: "pending",
			normalizedTargetEmail: "new.guest@example.test",
		});
		expect(buildExpiredInvitationFixture({ now: NOW })).toMatchObject({
			status: "expired",
			expiresAt: NOW - 1,
		});
		expect(buildSignedEngagementEvidenceFixture({ now: NOW })).toMatchObject({
			provider: "manual_admin",
			status: "signed",
		});
	});

	it("keeps platform_lawyer and guest_lawyer as dealAccess roles", async () => {
		const t = convexTest(schema, convexModules);
		const records = await t.run(async (ctx) => {
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
				streetAddress: "123 Access Contract St",
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
				interestRate: 9.5,
				interestAdjustmentDate: "2026-01-01",
				lienPosition: 1,
				loanType: "conventional",
				maturityDate: "2031-01-01",
				paymentAmount: 2500,
				paymentFrequency: "monthly",
				principal: 500_000,
				propertyId,
				rateType: "fixed",
				firstPaymentDate: "2026-02-01",
				status: "funded",
				termMonths: 60,
				termStartDate: "2026-01-01",
			});
			const dealId = await ctx.db.insert("deals", {
				buyerId: "buyer-auth",
				createdAt: NOW,
				createdBy: "system:test",
				fractionalShare: 10,
				mortgageId,
				sellerId: "seller-auth",
				status: "lawyerOnboarding.pending",
			});
			await ctx.db.insert("dealAccess", {
				dealId,
				grantedAt: NOW,
				grantedBy: "system:test",
				role: "platform_lawyer",
				status: "active",
				userId: "user_platform_lawyer",
			});
			await ctx.db.insert("dealAccess", {
				dealId,
				grantedAt: NOW,
				grantedBy: "system:test",
				role: "guest_lawyer",
				status: "active",
				userId: "guest@example.test",
			});
			return await ctx.db.query("dealAccess").collect();
		});

		expect(records.map((record) => record.role).sort()).toEqual([
			"guest_lawyer",
			"platform_lawyer",
		]);
		expect(
			records.every((record) => typeof record.grantedBy === "string")
		).toBe(true);
	});
});
