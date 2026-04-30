import { describe, expect, it } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ensureSeededIdentity } from "../../auth/helpers";
import {
	buildVerifiedMemberIdentity,
	createActivePortal,
	getUserByAuthId,
} from "../onboarding/brokerApplicationTestHelpers";
import { createGovernedTestConvex } from "../onboarding/helpers";

process.env.DISABLE_GT_HASHCHAIN = "true";
process.env.DISABLE_CASH_LEDGER_HASHCHAIN = "true";

async function insertBroker(
	t: ReturnType<typeof createGovernedTestConvex>,
	args: {
		brokerageName?: string;
		invitedByBrokerId?: string;
		licenseId?: string;
		licenseProvince?: string;
		onboardedAt?: number;
		orgId?: string;
		referralSource?: "broker_invite" | "self_signup";
		status?: string;
		userId: Id<"users">;
	}
) {
	return t.run(async (ctx) => {
		const now = Date.now();
		return ctx.db.insert("brokers", {
			status: args.status ?? "provisional",
			lastTransitionAt: now,
			userId: args.userId,
			licenseId: args.licenseId,
			licenseProvince: args.licenseProvince ?? (args.licenseId ? "ON" : undefined),
			brokerageName: args.brokerageName,
			orgId: args.orgId,
			referralSource: args.referralSource,
			invitedByBrokerId: args.invitedByBrokerId,
			onboardedAt: args.onboardedAt,
			createdAt: now,
			updatedAt: now,
		});
	});
}

function convergeClaim(
	t: ReturnType<typeof createGovernedTestConvex>,
	args: {
		brokerageName?: string;
		licenseProvince?: string;
		requestedPortalSlug?: string;
		targetOrganizationId?: string;
		now?: number;
		userId: Id<"users">;
		verifiedEmail?: string;
		verifiedLicenseId?: string;
	}
) {
	return t.mutation("brokers/claimConvergence:convergeBrokerClaimHarness", {
		brokerageName: args.brokerageName,
		licenseProvince: args.licenseProvince ?? "ON",
		now: args.now,
		requestedPortalSlug: args.requestedPortalSlug,
		targetOrganizationId: args.targetOrganizationId ?? "org_claim_target",
		userId: args.userId,
		verifiedEmail: args.verifiedEmail,
		verifiedLicenseId: args.verifiedLicenseId,
	});
}

describe("broker claim convergence", () => {
	it("reuses a safe existing broker, patches missing profile fields, and reuses the broker portal assignment path", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("claim-safe-reuse");
		const userId = await ensureSeededIdentity(t, identity);
		const brokerId = await insertBroker(t, {
			licenseId: "ON-CLAIM-SAFE",
			userId,
		});
		const portalId = await createActivePortal(t, "claim-safe-reuse");
		await t.run(async (ctx) => {
			await ctx.db.patch(portalId, {
				brokerId,
				orgId: "org_claim_target",
			});
		});

		const outcome = await convergeClaim(t, {
			brokerageName: "Claim Safe Brokerage",
			requestedPortalSlug: "claim-safe-reuse",
			userId,
			verifiedEmail: identity.user_email,
			verifiedLicenseId: "on-claim-safe",
		});
		const broker = await t.run(async (ctx) => ctx.db.get(brokerId));
		const user = await getUserByAuthId(t, identity.subject);
		const brokersByLicense = await t.run(async (ctx) =>
			ctx.db
				.query("brokers")
				.withIndex("by_license", (query) =>
					query.eq("licenseId", "ON-CLAIM-SAFE")
				)
				.collect()
		);

		expect(outcome).toMatchObject({
			kind: "reused_existing_broker",
			brokerId,
			brokerWasPatched: true,
			homePortalId: portalId,
			nextStep: "broker_portal_ready",
			portalId,
			portalWasCreated: false,
			reason: "safe_match",
		});
		expect(outcome.matchedBy).toEqual(
			expect.arrayContaining(["auth_linked_user", "verified_license"])
		);
		expect(brokersByLicense).toHaveLength(1);
		expect(broker).toMatchObject({
			_id: brokerId,
			brokerageName: "Claim Safe Brokerage",
			licenseId: "ON-CLAIM-SAFE",
			orgId: "org_claim_target",
			status: "active",
			userId,
			activatedPortalId: portalId,
		});
		expect(user?.homePortalId).toBe(portalId);
	});

	it("fails closed when verified license matching is ambiguous", async () => {
		const t = createGovernedTestConvex();
		const claimant = buildVerifiedMemberIdentity("claim-ambiguous");
		const claimantUserId = await ensureSeededIdentity(t, claimant);
		const firstOwner = buildVerifiedMemberIdentity("claim-ambiguous-owner-a");
		const secondOwner = buildVerifiedMemberIdentity("claim-ambiguous-owner-b");
		const firstOwnerId = await ensureSeededIdentity(t, firstOwner);
		const secondOwnerId = await ensureSeededIdentity(t, secondOwner);
		const firstBrokerId = await insertBroker(t, {
			licenseId: "ON-AMBIGUOUS",
			userId: firstOwnerId,
		});
		const secondBrokerId = await insertBroker(t, {
			licenseId: "ON-AMBIGUOUS",
			userId: secondOwnerId,
		});

		const outcome = await convergeClaim(t, {
			userId: claimantUserId,
			verifiedEmail: claimant.user_email,
			verifiedLicenseId: "ON-AMBIGUOUS",
		});

		expect(outcome).toEqual({
			kind: "manual_review_required",
			nextStep: "manual_review",
			reason: "ambiguous_verified_license",
			conflictingBrokerIds: [firstBrokerId, secondBrokerId],
		});
	});

	it("fails closed when verified email matching is ambiguous by normalized casing", async () => {
		const t = createGovernedTestConvex();
		const claimant = buildVerifiedMemberIdentity("claim-email-ambiguous");
		const claimantUserId = await ensureSeededIdentity(t, claimant);
		await t.run(async (ctx) => {
			await ctx.db.insert("users", {
				authId: "user_claim_email_ambiguous_duplicate",
				email: claimant.user_email.toUpperCase(),
				normalizedEmail: claimant.user_email.toLowerCase(),
				firstName: "Duplicate",
				lastName: "Email",
			});
		});

		const outcome = await convergeClaim(t, {
			userId: claimantUserId,
			verifiedEmail: claimant.user_email,
			verifiedLicenseId: "ON-EMAIL-AMBIGUOUS",
		});

		expect(outcome).toEqual({
			kind: "manual_review_required",
			nextStep: "manual_review",
			reason: "ambiguous_verified_email",
		});
	});

	it("uses normalized email matches without requiring an exact-case email match", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("claim-normalized-email-index");
		const userId = await ensureSeededIdentity(t, identity);
		const brokerId = await insertBroker(t, {
			licenseId: "ON-NORMALIZED-EMAIL",
			userId,
		});
		await t.run(async (ctx) => {
			await ctx.db.patch(userId, {
				email: identity.user_email.toUpperCase(),
				normalizedEmail: identity.user_email.toLowerCase(),
			});
		});

		const outcome = await convergeClaim(t, {
			userId,
			verifiedEmail: identity.user_email.toLowerCase(),
			verifiedLicenseId: "ON-NORMALIZED-EMAIL",
		});

		expect(outcome).toMatchObject({
			kind: "reused_existing_broker",
			brokerId,
			nextStep: "continue_self_serve_onboarding",
			reason: "safe_match",
		});
		expect(outcome.matchedBy).toEqual(
			expect.arrayContaining(["auth_linked_user", "verified_email"])
		);
	});

	it("fails closed when a user has duplicate auth-linked broker rows", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("claim-duplicate-brokers");
		const userId = await ensureSeededIdentity(t, identity);
		const firstBrokerId = await insertBroker(t, {
			licenseId: "ON-DUPLICATE-A",
			userId,
		});
		const secondBrokerId = await insertBroker(t, {
			licenseId: "ON-DUPLICATE-B",
			userId,
		});

		const outcome = await convergeClaim(t, {
			userId,
			verifiedEmail: identity.user_email,
			verifiedLicenseId: "ON-DUPLICATE-A",
		});

		expect(outcome).toEqual({
			kind: "manual_review_required",
			nextStep: "manual_review",
			reason: "duplicate_auth_linked_brokers",
			conflictingBrokerIds: [firstBrokerId, secondBrokerId],
		});
	});

	it("routes unmatched verified claims to self-serve without silently provisioning a broker", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("claim-no-match");
		const userId = await ensureSeededIdentity(t, identity);

		const outcome = await convergeClaim(t, {
			userId,
			verifiedEmail: identity.user_email,
			verifiedLicenseId: "ON-NO-MATCH",
		});
		const brokers = await t.run(async (ctx) =>
			ctx.db
				.query("brokers")
				.withIndex("by_license", (query) =>
					query.eq("licenseId", "ON-NO-MATCH")
				)
				.collect()
		);

		expect(outcome).toEqual({
			kind: "continue_self_serve_onboarding",
			nextStep: "self_serve_onboarding",
			reason: "no_safe_match",
		});
		expect(brokers).toHaveLength(0);
	});

	it("patches a safe broker match without activating when no portal slug is provided", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("claim-safe-no-portal");
		const userId = await ensureSeededIdentity(t, identity);
		const brokerId = await insertBroker(t, {
			licenseId: "ON-NO-PORTAL",
			status: "provisional",
			userId,
		});

		const outcome = await convergeClaim(t, {
			brokerageName: "No Portal Brokerage",
			userId,
			verifiedEmail: identity.user_email,
			verifiedLicenseId: "ON-NO-PORTAL",
		});
		const broker = await t.run(async (ctx) => ctx.db.get(brokerId));
		const user = await getUserByAuthId(t, identity.subject);

		expect(outcome).toMatchObject({
			kind: "reused_existing_broker",
			brokerId,
			brokerWasPatched: true,
			nextStep: "continue_self_serve_onboarding",
			reason: "safe_match",
		});
		expect(broker).toMatchObject({
			_id: brokerId,
			brokerageName: "No Portal Brokerage",
			licenseId: "ON-NO-PORTAL",
			orgId: "org_claim_target",
			status: "provisional",
			userId,
		});
		expect(broker?.activatedPortalId).toBeUndefined();
		expect(user?.homePortalId).toBeUndefined();
	});

	it("preserves existing broker profile fields during portal-ready activation", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("claim-preserve-broker-fields");
		const userId = await ensureSeededIdentity(t, identity);
		const brokerId = await insertBroker(t, {
			brokerageName: "Existing Brokerage",
			invitedByBrokerId: "broker_existing_inviter",
			licenseId: "ON-PRESERVE-FIELDS",
			licenseProvince: "BC",
			orgId: "org_claim_target",
			referralSource: "broker_invite",
			status: "provisional",
			userId,
		});

		const outcome = await convergeClaim(t, {
			brokerageName: "Conflicting Claim Brokerage",
			licenseProvince: "ON",
			requestedPortalSlug: "claim-preserve-broker-fields",
			targetOrganizationId: "org_claim_target",
			userId,
			verifiedEmail: identity.user_email,
			verifiedLicenseId: "ON-PRESERVE-FIELDS",
		});
		const broker = await t.run(async (ctx) => ctx.db.get(brokerId));

		expect(outcome).toMatchObject({
			kind: "reused_existing_broker",
			brokerId,
			nextStep: "broker_portal_ready",
			reason: "safe_match",
		});
		expect(broker).toMatchObject({
			_id: brokerId,
			brokerageName: "Existing Brokerage",
			invitedByBrokerId: "broker_existing_inviter",
			licenseProvince: "BC",
			orgId: "org_claim_target",
			referralSource: "broker_invite",
			status: "active",
			userId,
		});
	});

	it("reports portal-ready broker patch status from actual broker changes", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("claim-no-broker-patch");
		const userId = await ensureSeededIdentity(t, identity);
		const portalId = await createActivePortal(t, "claim-no-broker-patch");
		const now = Date.now();
		const brokerId = await t.run(async (ctx) =>
			ctx.db.insert("brokers", {
				activatedPortalId: portalId,
				brokerageName: "No Patch Brokerage",
				createdAt: now,
				lastTransitionAt: now,
				licenseId: "ON-NO-BROKER-PATCH",
				licenseProvince: "ON",
				onboardedAt: now,
				orgId: "org_claim_target",
				referralSource: "self_signup",
				status: "active",
				updatedAt: now,
				userId,
			})
		);
		await t.run(async (ctx) => {
			await ctx.db.patch(portalId, {
				brokerId,
				orgId: "org_claim_target",
			});
		});

		const outcome = await convergeClaim(t, {
			brokerageName: "No Patch Brokerage",
			licenseProvince: "ON",
			now,
			requestedPortalSlug: "claim-no-broker-patch",
			targetOrganizationId: "org_claim_target",
			userId,
			verifiedEmail: identity.user_email,
			verifiedLicenseId: "ON-NO-BROKER-PATCH",
		});

		expect(outcome).toMatchObject({
			kind: "reused_existing_broker",
			brokerId,
			brokerWasPatched: false,
			nextStep: "broker_portal_ready",
			portalId,
			portalWasCreated: false,
			reason: "safe_match",
		});
	});

	it("preserves an existing broker portal slug when claim requests a different slug", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("claim-preserve-portal");
		const userId = await ensureSeededIdentity(t, identity);
		const brokerId = await insertBroker(t, {
			licenseId: "ON-PRESERVE-PORTAL",
			orgId: "org_claim_target",
			userId,
		});
		const portalId = await createActivePortal(t, "existing-claim-portal");
		await t.run(async (ctx) => {
			await ctx.db.patch(portalId, {
				brokerId,
				orgId: "org_claim_target",
			});
		});

		const outcome = await convergeClaim(t, {
			requestedPortalSlug: "different-claim-portal",
			targetOrganizationId: "org_claim_target",
			userId,
			verifiedEmail: identity.user_email,
			verifiedLicenseId: "ON-PRESERVE-PORTAL",
		});
		const portal = await t.run(async (ctx) => ctx.db.get(portalId));

		expect(outcome).toMatchObject({
			kind: "reused_existing_broker",
			portalId,
			portalWasCreated: false,
			nextStep: "broker_portal_ready",
			reason: "safe_match",
		});
		expect(portal).toMatchObject({
			_id: portalId,
			brokerId,
			orgId: "org_claim_target",
			slug: "existing-claim-portal",
		});
	});

	it("requires verified identifiers before claim convergence can reuse a broker", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("claim-missing-identifiers");
		const userId = await ensureSeededIdentity(t, identity);
		await insertBroker(t, {
			licenseId: "ON-MISSING-CLAIM",
			userId,
		});

		const outcome = await convergeClaim(t, {
			userId,
			verifiedEmail: identity.user_email,
		});

		expect(outcome).toEqual({
			kind: "continue_self_serve_onboarding",
			nextStep: "self_serve_onboarding",
			reason: "missing_verified_identifiers",
		});
	});

	it("routes cross-user safe-looking license matches to manual review", async () => {
		const t = createGovernedTestConvex();
		const claimant = buildVerifiedMemberIdentity("claim-cross-user");
		const owner = buildVerifiedMemberIdentity("claim-cross-user-owner");
		const claimantUserId = await ensureSeededIdentity(t, claimant);
		const ownerUserId = await ensureSeededIdentity(t, owner);
		const brokerId = await insertBroker(t, {
			licenseId: "ON-CROSS-USER",
			userId: ownerUserId,
		});

		const outcome = await convergeClaim(t, {
			userId: claimantUserId,
			verifiedEmail: claimant.user_email,
			verifiedLicenseId: "ON-CROSS-USER",
		});

		expect(outcome).toEqual({
			kind: "manual_review_required",
			nextStep: "manual_review",
			reason: "cross_user_match",
			conflictingBrokerIds: [brokerId],
		});
	});

	it("routes cross-org safe-looking matches to manual review", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("claim-cross-org");
		const userId = await ensureSeededIdentity(t, identity);
		const brokerId = await insertBroker(t, {
			licenseId: "ON-CROSS-ORG",
			orgId: "org_existing_broker",
			userId,
		});

		const outcome = await convergeClaim(t, {
			targetOrganizationId: "org_claim_target",
			userId,
			verifiedEmail: identity.user_email,
			verifiedLicenseId: "ON-CROSS-ORG",
		});

		expect(outcome).toEqual({
			kind: "manual_review_required",
			nextStep: "manual_review",
			reason: "cross_org_match",
			conflictingBrokerIds: [brokerId],
		});
	});
});
