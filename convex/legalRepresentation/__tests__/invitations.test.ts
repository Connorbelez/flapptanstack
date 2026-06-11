import { anyApi } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it } from "vitest";
import { FAIRLEND_ADMIN } from "../../../src/test/auth/identities";
import { registerAuditLogComponent } from "../../../src/test/convex/registerAuditLogComponent";
import type { Id } from "../../_generated/dataModel";
import {
	setWorkosProvisioningForTests,
	type WorkosProvisioning,
} from "../../engine/effects/workosProvisioning";
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
const workosInvitationsApi = anyApi.legalRepresentation.workosInvitations;

afterEach(() => {
	setWorkosProvisioningForTests(null);
});

function createHarness() {
	const t = convexTest(schema, convexModules);
	registerAuditLogComponent(t, "auditLog");
	return t;
}

function installWorkosInvitationLookup(args?: {
	readonly email?: string;
	readonly invitationId?: string;
}) {
	const provisioning = {
		createOrganization: async () => ({ id: "org_unused" }),
		createOrganizationMembership: async () => ({ id: "om_unused" }),
		createUser: async (input: { email: string }) => ({
			email: input.email,
			id: "user_unused",
		}),
		findInvitationByToken: async (token: string) => ({
			email: args?.email ?? "riley.guest@example.test",
			id: args?.invitationId ?? "workos_invitation_1",
			state: "pending",
			token,
		}),
		listUsers: async () => [],
		resendInvitation: async (invitationId: string) => ({
			email: args?.email ?? "riley.guest@example.test",
			id: invitationId,
			state: "pending",
		}),
		revokeInvitation: async (invitationId: string) => ({
			email: args?.email ?? "riley.guest@example.test",
			id: invitationId,
			state: "revoked",
		}),
		sendInvitation: async (input: { email: string }) => ({
			email: input.email,
			id: args?.invitationId ?? "workos_invitation_1",
			state: "pending",
			token: "workos_token_1",
		}),
	} as unknown as WorkosProvisioning;
	setWorkosProvisioningForTests(provisioning);
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

async function insertPlatformInvitation(t: ReturnType<typeof createHarness>) {
	return await t.run(async (ctx) => {
		const profileId = await ctx.db.insert("lawyerProfiles", {
			barNumber: "LSO-777777",
			createdAt: NOW,
			displayName: "Pending Platform",
			email: "platform.pending@example.test",
			firmName: "Platform LLP",
			jurisdiction: "ON",
			normalizedEmail: "platform.pending@example.test",
			platformStatus: "invited",
			profileKind: "platform",
			updatedAt: NOW,
		});
		const invitationId = await ctx.db.insert("platformLawyerInvitations", {
			barNumber: "LSO-777777",
			createdAt: NOW,
			createdBy: "user_fairlend_admin",
			deliveredAt: NOW,
			deliveryStatus: "sent",
			displayName: "Pending Platform",
			email: "platform.pending@example.test",
			firmName: "Platform LLP",
			jurisdiction: "ON",
			lawyerProfileId: profileId,
			normalizedEmail: "platform.pending@example.test",
			status: "sent",
			updatedAt: NOW,
			workosInvitationId: "workos_platform_invitation",
		});
		return { invitationId, profileId };
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
		).resolves.toMatchObject({ dealId, status: "pending" });
	});

	it("routes a valid raw token into lawyer onboarding without granting deal access", async () => {
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

		expect(accepted).toMatchObject({
			dealId,
			status: "onboarding_required",
			targetEmail: "riley.guest@example.test",
		});
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
				onboardingSession:
					"onboardingSessionId" in accepted
						? await ctx.db.get(accepted.onboardingSessionId)
						: null,
				profiles: await ctx.db.query("lawyerProfiles").collect(),
				provisional,
				verifications: await ctx.db.query("lawyerVerifications").collect(),
			};
		});
		expect(rows.provisional).toMatchObject({
			status: "active",
			userId: normalizedEmail,
		});
		expect(rows.authAccess).toHaveLength(0);
		expect(rows.deal?.lawyerId).toBe(normalizedEmail);
		expect(rows.invitations[0]).toMatchObject({
			resolvedAuthId: "user_guest_lawyer",
			status: "accepted",
		});
		expect(rows.onboardingSession).toMatchObject({
			dealId,
			normalizedTargetEmail: normalizedEmail,
			status: "auth_pending",
		});
		expect(rows.profiles).toHaveLength(0);
		expect(rows.verifications).toHaveLength(0);

		const reused = await t
			.withIdentity(lawyerIdentity())
			.mutation(invitationsApi.acceptGuestInvitation, {
				now: NOW + 2,
				token: created.token,
			});
		expect(reused).toMatchObject({
			dealId,
			status: "onboarding_required",
		});
		if (
			!("onboardingSessionId" in accepted && "onboardingSessionId" in reused)
		) {
			throw new Error("Expected onboarding session result");
		}
		expect(reused.onboardingSessionId).toBe(accepted.onboardingSessionId);
	});

	it("routes a matching WorkOS invitation token into lawyer onboarding", async () => {
		const t = createHarness();
		installWorkosInvitationLookup();
		await insertSyncedLawyerIdentity(t);
		const lsoLawyerId = await t.run(async (ctx) =>
			ctx.db.insert(
				"lsoLawyers",
				buildEligiblePlatformLsoLawyerFixture({ now: NOW })
			)
		);
		const { dealId, provisionalAccessId } = await insertGuestDeal(t, {
			lsoLawyerId,
		});
		const created = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(invitationsApi.createGuestInvitationForDeal, {
				dealId,
				now: NOW,
			});
		await t.run(async (ctx) => {
			await ctx.db.patch(created.invitationId, {
				deliveryProvider: "workos",
				deliveryStatus: "sent",
				workosInvitationId: "workos_invitation_1",
			});
		});

		const accepted = await t
			.withIdentity(lawyerIdentity())
			.action(workosInvitationsApi.completeWorkosGuestInvitation, {
				invitationToken: "workos_token_1",
				now: NOW + 1,
			});

		expect(accepted).toMatchObject({
			dealId,
			status: "onboarding_required",
			targetEmail: "riley.guest@example.test",
		});
		const rows = await t.run(async (ctx) => ({
			authAccess: await ctx.db
				.query("dealAccess")
				.withIndex("by_user_and_deal", (query) =>
					query.eq("userId", "user_guest_lawyer").eq("dealId", dealId)
				)
				.collect(),
			invitation: await ctx.db.get(created.invitationId),
			onboardingSession:
				"onboardingSessionId" in accepted
					? await ctx.db.get(accepted.onboardingSessionId)
					: null,
			provisional: await ctx.db.get(provisionalAccessId),
		}));
		expect(rows.provisional).toMatchObject({ status: "active" });
		expect(rows.authAccess).toEqual([]);
		expect(rows.invitation).toMatchObject({
			resolvedAuthId: "user_guest_lawyer",
			status: "accepted",
		});
		expect(rows.onboardingSession).toMatchObject({
			dealId,
			normalizedTargetEmail: "riley.guest@example.test",
			status: "auth_pending",
		});

		const reloaded = await t
			.withIdentity(lawyerIdentity())
			.action(workosInvitationsApi.completeWorkosGuestInvitation, {
				invitationToken: "workos_token_1",
				now: NOW + 2,
			});
		expect(reloaded).toMatchObject({
			dealId,
			status: "onboarding_required",
		});
		if (
			!("onboardingSessionId" in accepted && "onboardingSessionId" in reloaded)
		) {
			throw new Error("Expected onboarding session result");
		}
		expect(reloaded.onboardingSessionId).toBe(accepted.onboardingSessionId);
	});

	it("routes a matching platform WorkOS invitation token into deal-less lawyer onboarding", async () => {
		const t = createHarness();
		installWorkosInvitationLookup({
			email: "platform.pending@example.test",
			invitationId: "workos_platform_invitation",
		});
		await insertSyncedLawyerIdentity(t, {
			authId: "user_platform_pending",
			email: "platform.pending@example.test",
		});
		const { invitationId, profileId } = await insertPlatformInvitation(t);

		const resolved = await t.action(
			workosInvitationsApi.resolveWorkosInvitationToken,
			{
				invitationToken: "workos_platform_token",
			}
		);
		const accepted = await t
			.withIdentity(
				lawyerIdentity({
					authId: "user_platform_pending",
					email: "platform.pending@example.test",
				})
			)
			.action(workosInvitationsApi.completeWorkosGuestInvitation, {
				invitationToken: "workos_platform_token",
				now: NOW + 1,
			});

		expect(resolved).toMatchObject({
			emailMatches: true,
			invitationKind: "platform",
			status: "sent",
			targetEmail: "platform.pending@example.test",
		});
		expect(resolved.dealId).toBeUndefined();
		expect(resolved.nextRoute).toContain("/lawyer/onboarding/");
		expect(accepted).toMatchObject({
			invitationKind: "platform",
			status: "onboarding_required",
			targetEmail: "platform.pending@example.test",
		});
		expect(accepted.dealId).toBeUndefined();
		const rows = await t.run(async (ctx) => ({
			invitation: await ctx.db.get(invitationId),
			onboardingSession:
				"onboardingSessionId" in accepted
					? await ctx.db.get(accepted.onboardingSessionId)
					: null,
			profile: await ctx.db.get(profileId),
		}));
		expect(rows.invitation).toMatchObject({
			status: "sent",
		});
		expect(rows.onboardingSession).toMatchObject({
			lawyerProfileId: profileId,
			normalizedTargetEmail: "platform.pending@example.test",
			path: "platform_application",
			platformLawyerInvitationId: invitationId,
			returnPath: "/lawyer",
			status: "auth_pending",
		});
		expect(rows.onboardingSession?.dealId).toBeUndefined();
		expect(rows.profile).toMatchObject({
			platformStatus: "invited",
		});
	});

	it("keeps legacy WorkOS internal acceptance on onboarding without granting final access", async () => {
		const t = createHarness();
		await insertSyncedLawyerIdentity(t);
		const lsoLawyerId = await t.run(async (ctx) =>
			ctx.db.insert(
				"lsoLawyers",
				buildEligiblePlatformLsoLawyerFixture({ now: NOW })
			)
		);
		const { dealId, normalizedEmail, provisionalAccessId } =
			await insertGuestDeal(t, {
				lsoLawyerId,
			});
		const created = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(invitationsApi.createGuestInvitationForDeal, {
				dealId,
				now: NOW,
			});
		await t.run((ctx) =>
			ctx.db.patch(created.invitationId, {
				deliveryProvider: "workos",
				deliveryStatus: "sent",
				workosInvitationId: "workos_invitation_legacy",
			})
		);

		const accepted = await t.mutation(
			invitationsApi.acceptGuestInvitationByWorkosInvitationInternal,
			{
				invitationEmail: "riley.guest@example.test",
				now: NOW + 1,
				viewer: {
					authId: "user_guest_lawyer",
					email: "riley.guest@example.test",
					permissions: ["lawyer:access", "deal:view"],
					role: "lawyer",
					roles: ["lawyer"],
					verifiedEmail: "riley.guest@example.test",
				},
				workosInvitationId: "workos_invitation_legacy",
			}
		);

		expect(accepted).toMatchObject({
			dealId,
			status: "onboarding_required",
			targetEmail: "riley.guest@example.test",
		});
		const rows = await t.run(async (ctx) => ({
			authAccess: await ctx.db
				.query("dealAccess")
				.withIndex("by_user_and_deal", (query) =>
					query.eq("userId", "user_guest_lawyer").eq("dealId", dealId)
				)
				.collect(),
			deal: await ctx.db.get(dealId),
			invitation: await ctx.db.get(created.invitationId),
			onboardingSession:
				"onboardingSessionId" in accepted
					? await ctx.db.get(accepted.onboardingSessionId)
					: null,
			profiles: await ctx.db.query("lawyerProfiles").collect(),
			provisional: await ctx.db.get(provisionalAccessId),
			verifications: await ctx.db.query("lawyerVerifications").collect(),
		}));
		expect(rows.authAccess).toEqual([]);
		expect(rows.deal?.lawyerId).toBe(normalizedEmail);
		expect(rows.invitation).toMatchObject({
			resolvedAuthId: "user_guest_lawyer",
			status: "accepted",
		});
		expect(rows.onboardingSession).toMatchObject({
			dealId,
			normalizedTargetEmail: normalizedEmail,
			status: "auth_pending",
		});
		expect(rows.profiles).toEqual([]);
		expect(rows.provisional).toMatchObject({ status: "active" });
		expect(rows.verifications).toEqual([]);
	});

	it("rejects WorkOS invitation completion when the WorkOS email does not match the FairLend invitation", async () => {
		const t = createHarness();
		installWorkosInvitationLookup({ email: "wrong@example.test" });
		await insertSyncedLawyerIdentity(t);
		const { dealId } = await insertGuestDeal(t);
		const created = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(invitationsApi.createGuestInvitationForDeal, {
				dealId,
				now: NOW,
			});
		await t.run(async (ctx) => {
			await ctx.db.patch(created.invitationId, {
				deliveryProvider: "workos",
				deliveryStatus: "sent",
				workosInvitationId: "workos_invitation_1",
			});
		});

		await expect(
			t
				.withIdentity(lawyerIdentity())
				.action(workosInvitationsApi.completeWorkosGuestInvitation, {
					invitationToken: "workos_token_1",
					now: NOW + 1,
				})
		).rejects.toThrow("WorkOS invitation email does not match");
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

		expect(expired).toMatchObject({ dealId, status: "expired" });
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
		).resolves.toMatchObject({ dealId, status: "pending" });
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

		expect(accepted).toMatchObject({ dealId, status: "revoked" });
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

	it("does not mutate returning guest profiles before onboarding completion", async () => {
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
			status: "onboarding_required",
		});
		const profiles = await t.run(async (ctx) =>
			ctx.db.query("lawyerProfiles").collect()
		);
		expect(profiles).toHaveLength(1);
		expect(profiles[0]?.authId).toBeUndefined();
		expect(profiles[0]).toMatchObject({
			_id: existingProfileId,
			displayName: "Old Riley",
		});
	});

	it("routes restricted selected lawyers into onboarding without granting auth ID access", async () => {
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

		expect(accepted).toMatchObject({ status: "onboarding_required" });
		const rows = await t.run(async (ctx) => ({
			access: await ctx.db
				.query("dealAccess")
				.withIndex("by_user_and_deal", (query) =>
					query.eq("userId", "user_guest_lawyer").eq("dealId", dealId)
				)
				.collect(),
			invitation: await ctx.db.get(created.invitationId),
			onboardingSessions: await ctx.db
				.query("lawyerOnboardingSessions")
				.collect(),
			verifications: await ctx.db.query("lawyerVerifications").collect(),
		}));
		expect(rows.access).toEqual([]);
		expect(rows.invitation).toMatchObject({ status: "accepted" });
		expect(rows.onboardingSessions).toHaveLength(1);
		expect(rows.onboardingSessions[0]).toMatchObject({
			status: "auth_pending",
		});
		expect(rows.verifications).toEqual([]);
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
