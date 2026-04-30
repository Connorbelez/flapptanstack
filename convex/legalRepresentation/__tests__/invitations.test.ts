import { anyApi } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { FAIRLEND_ADMIN } from "../../../src/test/auth/identities";
import { registerAuditLogComponent } from "../../../src/test/convex/registerAuditLogComponent";
import type { Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";
import {
	buildEligiblePlatformLsoLawyerFixture,
	buildRestrictedLsoLawyerFixture,
} from "../fixtures";
import { normalizeLawyerEmail } from "../normalization";

const NOW = 1_770_000_000_000;
const SHA_256_HEX_PATTERN = /^[0-9a-f]{64}$/u;
const invitationsApi = anyApi.legalRepresentation.invitations;

function createHarness() {
	const t = convexTest(schema, convexModules);
	registerAuditLogComponent(t, "auditLog");
	return t;
}

function lawyerIdentity(args?: {
	readonly authId?: string;
	readonly email?: string;
}) {
	return {
		subject: args?.authId ?? "user_guest_lawyer",
		issuer: "https://api.workos.com",
		org_id: "org_guest_lawfirm",
		organization_name: "Guest Law Firm",
		role: "lawyer",
		roles: JSON.stringify(["lawyer"]),
		permissions: JSON.stringify(["lawyer:access", "deal:view"]),
		user_email: args?.email ?? "riley.guest@example.test",
		user_email_verified: true,
		user_first_name: "Riley",
		user_last_name: "Guest",
	};
}

async function insertSyncedLawyerIdentity(
	t: ReturnType<typeof createHarness>,
	args?: {
		readonly authId?: string;
		readonly email?: string;
	}
) {
	const authId = args?.authId ?? "user_guest_lawyer";
	const email = args?.email ?? "riley.guest@example.test";
	await t.run(async (ctx) => {
		await ctx.db.insert("users", {
			authId,
			email,
			firstName: "Riley",
			lastName: "Guest",
		});
		await ctx.db.insert("organizationMemberships", {
			organizationName: "Guest Law Firm",
			organizationWorkosId: "org_guest_lawfirm",
			roleSlug: "lawyer",
			roleSlugs: ["lawyer"],
			status: "active",
			userWorkosId: authId,
			workosId: `om_${authId}`,
		});
	});
}

async function insertGuestDeal(
	t: ReturnType<typeof createHarness>,
	args?: {
		readonly lsoLawyerId?: Id<"lsoLawyers">;
		readonly targetEmail?: string;
	}
) {
	return await t.run(async (ctx) => {
		const targetEmail = args?.targetEmail ?? "riley.guest@example.test";
		const normalizedEmail = normalizeLawyerEmail(targetEmail);
		const userId = await ctx.db.insert("users", {
			authId: "broker-auth",
			email: "broker@example.test",
			firstName: "Broker",
			lastName: "User",
		});
		const propertyId = await ctx.db.insert("properties", {
			city: "Toronto",
			createdAt: NOW,
			postalCode: "M5V 1A1",
			propertyType: "residential",
			province: "ON",
			streetAddress: "123 Invite St",
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
		const dealId = await ctx.db.insert("deals", {
			buyerId: "buyer-auth",
			createdAt: NOW,
			createdBy: "system:test",
			fractionalShare: 10,
			lawyerId: normalizedEmail,
			lawyerType: "guest_lawyer",
			mortgageId,
			selectedLawyer: {
				type: "guest_lawyer",
				source: "lso_search",
				name: "Riley Guest",
				email: targetEmail,
				firm: "Guest Legal",
				lso: {
					barNumber: "LSO-654321",
					jurisdiction: "ON",
					licensingStatus: "licensed",
					lsoLawyerId: args?.lsoLawyerId,
					restrictionStatus: "clear",
					source: "test_fixture",
					sourceFetchedAt: NOW,
				},
			},
			sellerId: "seller-auth",
			status: "lawyerOnboarding.pending",
		});
		const provisionalAccessId = await ctx.db.insert("dealAccess", {
			dealId,
			grantedAt: NOW,
			grantedBy: "system:test",
			role: "guest_lawyer",
			status: "active",
			userId: normalizedEmail,
		});
		return { dealId, normalizedEmail, provisionalAccessId };
	});
}

describe("guest lawyer invitations", () => {
	it("creates scoped hash-only invite records and exposes only the raw token at creation", async () => {
		const t = createHarness();
		const { dealId } = await insertGuestDeal(t);

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(invitationsApi.createGuestInvitationForDeal, {
				baseUrl: "https://app.example.test",
				dealId,
				now: NOW,
			});
		const invitation = await t.run(async (ctx) =>
			ctx.db.get(result.invitationId)
		);

		expect(result.inviteUrl).toBe(
			`https://app.example.test/lawyer/verify/${encodeURIComponent(result.token)}`
		);
		expect(invitation).toMatchObject({
			dealId,
			normalizedTargetEmail: "riley.guest@example.test",
			status: "pending",
		});
		expect(invitation?.tokenHash).not.toBe(result.token);
		expect(invitation?.tokenHash).toMatch(SHA_256_HEX_PATTERN);
		await expect(
			t.query(invitationsApi.getInvitationStatusByToken, {
				now: NOW,
				token: result.token,
			})
		).resolves.toMatchObject({ status: "pending" });
	});

	it("accepts a valid token, records evidence, and migrates provisional email access to auth ID", async () => {
		const t = createHarness();
		await insertSyncedLawyerIdentity(t);
		const lsoLawyerId = await t.run(async (ctx) =>
			ctx.db.insert(
				"lsoLawyers",
				buildEligiblePlatformLsoLawyerFixture({ now: NOW })
			)
		);
		const { dealId, normalizedEmail, provisionalAccessId } =
			await insertGuestDeal(t, { lsoLawyerId });
		const created = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(invitationsApi.createGuestInvitationForDeal, {
				dealId,
				now: NOW,
			});

		const accepted = await t
			.withIdentity(lawyerIdentity())
			.mutation(invitationsApi.acceptGuestInvitation, {
				now: NOW + 1,
				token: created.token,
			});

		expect(accepted.status).toBe("verified");
		const rows = await t.run(async (ctx) => {
			const deal = await ctx.db.get(dealId);
			const provisional = await ctx.db.get(provisionalAccessId);
			const authAccess = await ctx.db
				.query("dealAccess")
				.withIndex("by_user_and_deal", (query) =>
					query.eq("userId", "user_guest_lawyer").eq("dealId", dealId)
				)
				.collect();
			return {
				authAccess,
				deal,
				invitations: await ctx.db.query("lawyerInvitations").collect(),
				profiles: await ctx.db.query("lawyerProfiles").collect(),
				provisional,
				verifications: await ctx.db.query("lawyerVerifications").collect(),
			};
		});
		expect(rows.provisional).toMatchObject({
			status: "revoked",
			userId: normalizedEmail,
		});
		expect(rows.authAccess).toHaveLength(1);
		expect(rows.authAccess[0]).toMatchObject({
			role: "guest_lawyer",
			status: "active",
			userId: "user_guest_lawyer",
		});
		expect(rows.deal?.lawyerId).toBe("user_guest_lawyer");
		expect(rows.invitations[0]).toMatchObject({
			resolvedAuthId: "user_guest_lawyer",
			status: "verified",
		});
		expect(rows.profiles).toHaveLength(1);
		expect(rows.profiles[0]).toMatchObject({
			authId: "user_guest_lawyer",
			profileKind: "guest",
		});
		expect(rows.verifications).toHaveLength(1);
		expect(rows.verifications[0]).toMatchObject({
			outcome: "eligible",
			reasonCodes: ["active_license"],
		});

		const reused = await t
			.withIdentity(lawyerIdentity())
			.mutation(invitationsApi.acceptGuestInvitation, {
				now: NOW + 2,
				token: created.token,
			});
		expect(reused).toMatchObject({ status: "used" });
		await expect(
			t.run(async (ctx) => ctx.db.query("lawyerProfiles").collect())
		).resolves.toHaveLength(1);
	});

	it("rejects expired and tampered tokens fail-closed", async () => {
		const t = createHarness();
		await insertSyncedLawyerIdentity(t);
		const { dealId } = await insertGuestDeal(t);
		const created = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(invitationsApi.createGuestInvitationForDeal, {
				dealId,
				now: NOW,
				ttlMs: 1,
			});

		await expect(
			t.query(invitationsApi.getInvitationStatusByToken, {
				now: NOW,
				token: `${created.token}-tampered`,
			})
		).resolves.toMatchObject({ status: "not_found" });
		const expired = await t
			.withIdentity(lawyerIdentity())
			.mutation(invitationsApi.acceptGuestInvitation, {
				now: NOW + 2,
				token: created.token,
			});

		expect(expired).toMatchObject({ status: "expired" });
		await expect(
			t.run(async (ctx) =>
				ctx.db
					.query("dealAccess")
					.withIndex("by_user_and_deal", (query) =>
						query.eq("userId", "user_guest_lawyer").eq("dealId", dealId)
					)
					.collect()
			)
		).resolves.toEqual([]);
	});

	it("resends by rotating the token and rejects the old token", async () => {
		const t = createHarness();
		await insertSyncedLawyerIdentity(t);
		const { dealId } = await insertGuestDeal(t);
		const created = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(invitationsApi.createGuestInvitationForDeal, {
				dealId,
				now: NOW,
			});

		const resent = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(invitationsApi.resendGuestInvitation, {
				invitationId: created.invitationId,
				now: NOW + 1,
			});

		expect(resent.token).not.toBe(created.token);
		await expect(
			t.query(invitationsApi.getInvitationStatusByToken, {
				now: NOW + 2,
				token: created.token,
			})
		).resolves.toMatchObject({ status: "not_found" });
		await expect(
			t.query(invitationsApi.getInvitationStatusByToken, {
				now: NOW + 2,
				token: resent.token,
			})
		).resolves.toMatchObject({ status: "pending" });
	});

	it("rejects revoked invitations without granting auth ID access", async () => {
		const t = createHarness();
		await insertSyncedLawyerIdentity(t);
		const { dealId } = await insertGuestDeal(t);
		const created = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(invitationsApi.createGuestInvitationForDeal, {
				dealId,
				now: NOW,
			});

		await expect(
			t
				.withIdentity(FAIRLEND_ADMIN)
				.mutation(invitationsApi.revokeGuestInvitation, {
					invitationId: created.invitationId,
					now: NOW + 1,
				})
		).resolves.toMatchObject({ status: "revoked" });
		const accepted = await t
			.withIdentity(lawyerIdentity())
			.mutation(invitationsApi.acceptGuestInvitation, {
				now: NOW + 2,
				token: created.token,
			});

		expect(accepted).toMatchObject({ status: "revoked" });
		await expect(
			t.run(async (ctx) =>
				ctx.db
					.query("dealAccess")
					.withIndex("by_user_and_deal", (query) =>
						query.eq("userId", "user_guest_lawyer").eq("dealId", dealId)
					)
					.collect()
			)
		).resolves.toEqual([]);
	});

	it("resolves returning guest profiles without duplicating identities", async () => {
		const t = createHarness();
		await insertSyncedLawyerIdentity(t);
		const { dealId } = await insertGuestDeal(t);
		const existingProfileId = await t.run(async (ctx) =>
			ctx.db.insert("lawyerProfiles", {
				barNumber: "LSO654321",
				createdAt: NOW - 1,
				displayName: "Old Riley",
				email: "riley.guest@example.test",
				firmName: "Old Firm",
				jurisdiction: "ON",
				normalizedEmail: "riley.guest@example.test",
				profileKind: "guest",
				updatedAt: NOW - 1,
			})
		);
		const created = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(invitationsApi.createGuestInvitationForDeal, {
				dealId,
				now: NOW,
			});

		const accepted = await t
			.withIdentity(lawyerIdentity())
			.mutation(invitationsApi.acceptGuestInvitation, {
				now: NOW + 1,
				token: created.token,
			});

		expect(accepted).toMatchObject({
			lawyerProfileId: existingProfileId,
			status: "verified",
		});
		const profiles = await t.run(async (ctx) =>
			ctx.db.query("lawyerProfiles").collect()
		);
		expect(profiles).toHaveLength(1);
		expect(profiles[0]).toMatchObject({
			authId: "user_guest_lawyer",
			displayName: "Riley Guest",
		});
	});

	it("records failed evidence and does not grant auth ID access for restricted lawyers", async () => {
		const t = createHarness();
		await insertSyncedLawyerIdentity(t);
		const lsoLawyerId = await t.run(async (ctx) =>
			ctx.db.insert("lsoLawyers", buildRestrictedLsoLawyerFixture({ now: NOW }))
		);
		const { dealId } = await insertGuestDeal(t, { lsoLawyerId });
		const created = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(invitationsApi.createGuestInvitationForDeal, {
				dealId,
				now: NOW,
			});

		const accepted = await t
			.withIdentity(lawyerIdentity())
			.mutation(invitationsApi.acceptGuestInvitation, {
				now: NOW + 1,
				token: created.token,
			});

		expect(accepted).toMatchObject({ status: "failed" });
		const rows = await t.run(async (ctx) => ({
			access: await ctx.db
				.query("dealAccess")
				.withIndex("by_user_and_deal", (query) =>
					query.eq("userId", "user_guest_lawyer").eq("dealId", dealId)
				)
				.collect(),
			invitation: await ctx.db.get(created.invitationId),
			verifications: await ctx.db.query("lawyerVerifications").collect(),
		}));
		expect(rows.access).toEqual([]);
		expect(rows.invitation).toMatchObject({ status: "failed" });
		expect(rows.verifications[0]).toMatchObject({
			outcome: "ineligible",
			reasonCodes: ["license_restricted", "restriction_current"],
		});
	});

	it("rejects signed-in lawyers whose verified email does not match the invite", async () => {
		const t = createHarness();
		await insertSyncedLawyerIdentity(t, { email: "other@example.test" });
		const { dealId } = await insertGuestDeal(t);
		const created = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(invitationsApi.createGuestInvitationForDeal, {
				dealId,
				now: NOW,
			});

		const accepted = await t
			.withIdentity(lawyerIdentity({ email: "other@example.test" }))
			.mutation(invitationsApi.acceptGuestInvitation, {
				now: NOW + 1,
				token: created.token,
			});

		expect(accepted).toMatchObject({ status: "failed" });
		const rows = await t.run(async (ctx) => ({
			access: await ctx.db
				.query("dealAccess")
				.withIndex("by_user_and_deal", (query) =>
					query.eq("userId", "user_guest_lawyer").eq("dealId", dealId)
				)
				.collect(),
			invitation: await ctx.db.get(created.invitationId),
			verifications: await ctx.db.query("lawyerVerifications").collect(),
		}));
		expect(rows.access).toEqual([]);
		expect(rows.invitation).toMatchObject({ status: "failed" });
		expect(rows.verifications[0]).toMatchObject({
			outcome: "failed",
			reasonCodes: ["identity_mismatch"],
		});
	});
});
