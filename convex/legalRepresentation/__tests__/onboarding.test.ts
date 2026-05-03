import { anyApi } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { registerAuditLogComponent } from "../../../src/test/convex/registerAuditLogComponent";
import type { Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";
import { normalizeLawyerEmail } from "../normalization";

const NOW = 1_777_800_000_000;
const FUTURE_EXPIRES_AT = 4_102_444_800_000;
const onboardingApi = anyApi.legalRepresentation.onboarding;
const IDV_CHECKPOINT_REQUIRED_PATTERN = /IDV checkpoint is required/i;
const INVITATION_EXPIRED_PATTERN = /invitation expired/i;
const INVITATION_REVOKED_PATTERN = /invitation revoked/i;
const LAWYER_REQUIRED_PATTERN = /lawyer/i;
const SESSION_EMAIL_MISMATCH_PATTERN = /email does not match/i;
const LSO_MISMATCH_PATTERN = /selected lawyer/i;
const LSO_NOT_SELECTABLE_PATTERN = /not selectable/i;

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
		user_email: args?.email ?? "guest@example.test",
		user_email_verified: true,
		user_first_name: "Riley",
		user_last_name: "Guest",
	};
}

function nonLawyerIdentity() {
	return {
		subject: "user_not_lawyer",
		issuer: "https://api.workos.com",
		org_id: "org_guest_lawfirm",
		organization_name: "Guest Law Firm",
		role: "member",
		roles: JSON.stringify(["member"]),
		permissions: JSON.stringify(["deal:view"]),
		user_email: "guest@example.test",
		user_email_verified: true,
		user_first_name: "No",
		user_last_name: "Lawyer",
	};
}

async function seedGuestDeal(
	t: ReturnType<typeof convexTest>,
	args?: {
		readonly barNumber?: string;
		readonly jurisdiction?: string;
		readonly lsoLawyerId?: Id<"lsoLawyers">;
		readonly targetEmail?: string;
	}
) {
	return await t.run(async (ctx) => {
		const targetEmail = args?.targetEmail ?? "guest@example.test";
		const normalizedEmail = normalizeLawyerEmail(targetEmail);
		const brokerUserId = await ctx.db.insert("users", {
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
			streetAddress: "123 Onboarding St",
		});
		const brokerId = await ctx.db.insert("brokers", {
			createdAt: NOW,
			status: "active",
			userId: brokerUserId,
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
					barNumber: args?.barNumber ?? "L12345",
					jurisdiction: args?.jurisdiction ?? "ON",
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

async function seedPendingGuestInvitation(
	t: ReturnType<typeof convexTest>,
	args?: {
		readonly expiresAt?: number;
		readonly status?: "accepted" | "expired" | "pending" | "revoked";
	}
) {
	const { dealId } = await seedGuestDeal(t);
	const invitationId = await t.run(async (ctx) =>
		ctx.db.insert("lawyerInvitations", {
			createdAt: NOW,
			createdBy: "system:test",
			dealId,
			deliveryProvider: "workos",
			deliveryStatus: "pending",
			expiresAt: args?.expiresAt ?? FUTURE_EXPIRES_AT,
			normalizedTargetEmail: "guest@example.test",
			selectedLawyerSnapshot: {
				type: "guest_lawyer",
				source: "lso_search",
				name: "Riley Guest",
				email: "guest@example.test",
				firm: "Guest Legal",
				lso: {
					barNumber: "L12345",
					jurisdiction: "ON",
					licensingStatus: "licensed",
					restrictionStatus: "clear",
					source: "test_fixture",
					sourceFetchedAt: NOW,
				},
			},
			status: args?.status ?? "pending",
			targetEmail: "guest@example.test",
			tokenHash: "sha256:onboarding-test-token",
			updatedAt: NOW,
			workosInvitationId: "workos_invitation_onboarding",
		})
	);
	return { dealId, invitationId };
}

async function seedPendingPlatformInvitation(t: ReturnType<typeof convexTest>) {
	return await t.run(async (ctx) => {
		const profileId = await ctx.db.insert("lawyerProfiles", {
			barNumber: "L77777",
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
			barNumber: "L77777",
			createdAt: NOW,
			createdBy: "system:test",
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

async function seedGuestOnboardingSession(t: ReturnType<typeof convexTest>) {
	const { dealId, normalizedEmail, provisionalAccessId } =
		await seedGuestDeal(t);
	const sessionId = await t.run((ctx) =>
		ctx.db.insert("lawyerOnboardingSessions", {
			createdAt: NOW,
			currentStep: "auth",
			dealId,
			nextRoute: "/lawyer/onboarding/test",
			normalizedTargetEmail: normalizedEmail,
			path: "guest_invited",
			returnPath: `/deals/${String(dealId)}`,
			status: "auth_pending",
			updatedAt: NOW,
		})
	);
	return { dealId, normalizedEmail, provisionalAccessId, sessionId };
}

async function seedGuestOnboardingSessionWithSelectedLso(
	t: ReturnType<typeof convexTest>,
	lsoLawyerId: Id<"lsoLawyers">
) {
	const { dealId, normalizedEmail, provisionalAccessId } = await seedGuestDeal(
		t,
		{
			barNumber: "L99999",
			jurisdiction: "ON",
			lsoLawyerId,
		}
	);
	const sessionId = await t.run((ctx) =>
		ctx.db.insert("lawyerOnboardingSessions", {
			createdAt: NOW,
			currentStep: "auth",
			dealId,
			nextRoute: "/lawyer/onboarding/test",
			normalizedTargetEmail: normalizedEmail,
			path: "guest_invited",
			returnPath: `/deals/${String(dealId)}`,
			status: "auth_pending",
			updatedAt: NOW,
		})
	);
	return { dealId, normalizedEmail, provisionalAccessId, sessionId };
}

async function progressSessionToReadyForCompletion(
	auth: ReturnType<ReturnType<typeof createHarness>["withIdentity"]>,
	t: ReturnType<typeof createHarness>,
	sessionId: Id<"lawyerOnboardingSessions">
) {
	await auth.mutation(onboardingApi.confirmIdentity, { sessionId });
	await auth.mutation(onboardingApi.submitLsoLicense, {
		barNumber: "L12345",
		jurisdiction: "ON",
		sessionId,
	});
	await auth.mutation(onboardingApi.completeMockIdv, { sessionId });
	await t.run((ctx) =>
		ctx.db.patch(sessionId, {
			acceptedEngagementAt: NOW + 2,
			currentStep: "complete",
			engagementAcceptedAt: NOW + 2,
			status: "complete",
			updatedAt: NOW + 2,
		})
	);
}

describe("lawyer onboarding sessions", () => {
	it("loads an onboarding session for the owning lawyer", async () => {
		const t = createHarness();
		const auth = t.withIdentity(lawyerIdentity());
		const { sessionId } = await seedGuestOnboardingSession(t);

		const session = await auth.query(onboardingApi.getLawyerOnboardingSession, {
			sessionId,
		});

		expect(session).toMatchObject({
			_id: sessionId,
			normalizedTargetEmail: "guest@example.test",
			status: "auth_pending",
		});
	});

	it("does not expose another lawyer's onboarding session", async () => {
		const t = createHarness();
		const otherLawyer = t.withIdentity(
			lawyerIdentity({
				authId: "user_other_lawyer",
				email: "other-lawyer@example.test",
			})
		);
		const { sessionId } = await seedGuestOnboardingSession(t);

		const session = await otherLawyer.query(
			onboardingApi.getLawyerOnboardingSession,
			{ sessionId }
		);

		expect(session).toBeNull();
	});

	it("does not expose an unbound onboarding session to a lawyer viewer", async () => {
		const t = createHarness();
		const auth = t.withIdentity(lawyerIdentity());
		const { dealId } = await seedGuestDeal(t);
		const sessionId = await t.run((ctx) =>
			ctx.db.insert("lawyerOnboardingSessions", {
				createdAt: NOW,
				currentStep: "auth",
				dealId,
				nextRoute: "/lawyer/onboarding/unbound",
				path: "platform_assigned",
				returnPath: `/deals/${String(dealId)}`,
				status: "auth_pending",
				updatedAt: NOW,
			})
		);

		const session = await auth.query(onboardingApi.getLawyerOnboardingSession, {
			sessionId,
		});

		expect(session).toBeNull();
	});

	it("starts or resumes a guest invitation onboarding session through the internal trusted path", async () => {
		const t = createHarness();
		const { dealId, invitationId } = await seedPendingGuestInvitation(t);

		const result = await t.mutation(
			onboardingApi.startOrResumeForInvitationInternal,
			{
				invitationId,
			}
		);
		const resumed = await t.mutation(
			onboardingApi.startOrResumeForInvitationInternal,
			{
				invitationId,
			}
		);

		expect(result.session).toMatchObject({
			currentStep: "auth",
			dealId,
			invitationId,
			path: "guest_invited",
			returnPath: `/deals/${String(dealId)}`,
			status: "auth_pending",
		});
		expect(result.session.nextRoute).toBe(
			`/lawyer/onboarding/${String(result.session._id)}`
		);
		expect(resumed.session._id).toBe(result.session._id);
	});

	it("starts or resumes a platform invitation onboarding session through the internal trusted path", async () => {
		const t = createHarness();
		const { invitationId, profileId } = await seedPendingPlatformInvitation(t);

		const result = await t.mutation(
			onboardingApi.startOrResumeForPlatformInvitationInternal,
			{
				invitationId,
			}
		);
		const resumed = await t.mutation(
			onboardingApi.startOrResumeForPlatformInvitationInternal,
			{
				invitationId,
			}
		);

		expect(result.session).toMatchObject({
			currentStep: "auth",
			lawyerProfileId: profileId,
			normalizedTargetEmail: "platform.pending@example.test",
			path: "platform_application",
			platformLawyerInvitationId: invitationId,
			returnPath: "/lawyer",
			status: "auth_pending",
		});
		expect(result.session.dealId).toBeUndefined();
		expect(result.session.nextRoute).toBe(
			`/lawyer/onboarding/${String(result.session._id)}`
		);
		expect(resumed.session._id).toBe(result.session._id);
	});

	it("starts or resumes public invitation onboarding only for the target lawyer", async () => {
		const t = createHarness();
		const auth = t.withIdentity(lawyerIdentity());
		const { invitationId } = await seedPendingGuestInvitation(t);

		const result = await auth.mutation(
			onboardingApi.startOrResumeForInvitation,
			{
				invitationId,
			}
		);
		const resumed = await auth.mutation(
			onboardingApi.startOrResumeForInvitation,
			{
				invitationId,
			}
		);

		expect(result.session).toMatchObject({
			invitationId,
			path: "guest_invited",
			status: "auth_pending",
		});
		expect(resumed.session._id).toBe(result.session._id);
		await expect(
			t.mutation(onboardingApi.startOrResumeForInvitation, {
				invitationId,
			})
		).rejects.toThrow();
	});

	it("starts or resumes onboarding from deal context for the selected guest target", async () => {
		const t = createHarness();
		const auth = t.withIdentity(lawyerIdentity());
		const { dealId, invitationId } = await seedPendingGuestInvitation(t);

		const result = await auth.mutation(onboardingApi.startOrResumeForDeal, {
			dealId,
		});
		const resumed = await auth.mutation(onboardingApi.startOrResumeForDeal, {
			dealId,
		});

		expect(result.session).toMatchObject({
			dealId,
			invitationId,
			path: "guest_invited",
			status: "auth_pending",
		});
		expect(resumed.session._id).toBe(result.session._id);
	});

	it("starts platform-assigned onboarding from deal context", async () => {
		const t = createHarness();
		const auth = t.withIdentity(
			lawyerIdentity({
				authId: "user_platform_lawyer",
				email: "platform-lawyer@example.test",
			})
		);
		const { dealId } = await seedGuestDeal(t);
		const profileId = await t.run(async (ctx) => {
			const lawyerProfileId = await ctx.db.insert("lawyerProfiles", {
				authId: "user_platform_lawyer",
				createdAt: NOW,
				displayName: "Platform Lawyer",
				email: "platform-lawyer@example.test",
				normalizedEmail: "platform-lawyer@example.test",
				platformStatus: "active",
				profileKind: "platform",
				updatedAt: NOW,
			});
			await ctx.db.patch(dealId, {
				lawyerId: "user_platform_lawyer",
				lawyerType: "platform_lawyer",
				selectedLawyer: {
					email: "platform-lawyer@example.test",
					lawyerId: "user_platform_lawyer",
					name: "Platform Lawyer",
					type: "platform_lawyer",
				},
			});
			return lawyerProfileId;
		});

		const result = await auth.mutation(onboardingApi.startOrResumeForDeal, {
			dealId,
		});

		expect(result.session).toMatchObject({
			currentStep: "lso",
			dealId,
			lawyerProfileId: profileId,
			path: "platform_assigned",
			status: "lso_pending",
			workosUserId: "user_platform_lawyer",
		});
	});

	it("does not start onboarding for revoked or expired invitations", async () => {
		const t = createHarness();
		const revoked = await seedPendingGuestInvitation(t, {
			status: "revoked",
		});
		const expired = await seedPendingGuestInvitation(t, {
			expiresAt: NOW - 1,
		});

		await expect(
			t.mutation(onboardingApi.startOrResumeForInvitationInternal, {
				invitationId: revoked.invitationId,
			})
		).rejects.toThrow(INVITATION_REVOKED_PATTERN);
		await expect(
			t.mutation(onboardingApi.startOrResumeForInvitationInternal, {
				invitationId: expired.invitationId,
			})
		).rejects.toThrow(INVITATION_EXPIRED_PATTERN);
		const sessions = await t.run((ctx) =>
			ctx.db.query("lawyerOnboardingSessions").collect()
		);

		expect(sessions).toHaveLength(0);
	});

	it("does not complete a session after its invitation is revoked", async () => {
		const t = createHarness();
		const auth = t.withIdentity(lawyerIdentity());
		const { invitationId } = await seedPendingGuestInvitation(t);
		const started = await t.mutation(
			onboardingApi.startOrResumeForInvitationInternal,
			{
				invitationId,
			}
		);

		await progressSessionToReadyForCompletion(auth, t, started.session._id);
		await t.run((ctx) =>
			ctx.db.patch(invitationId, { status: "revoked", updatedAt: NOW + 1 })
		);
		await expect(
			auth.mutation(onboardingApi.completeSession, {
				sessionId: started.session._id,
			})
		).rejects.toThrow(INVITATION_REVOKED_PATTERN);
		const invitation = await t.run((ctx) => ctx.db.get(invitationId));

		expect(invitation).toMatchObject({ status: "revoked" });
	});

	it("progresses guest checkpoints to complete and migrates provisional access", async () => {
		const t = createHarness();
		const auth = t.withIdentity(
			lawyerIdentity({
				authId: "user_guest_lawyer",
				email: "guest@example.test",
			})
		);
		const { dealId, normalizedEmail, provisionalAccessId, sessionId } =
			await seedGuestOnboardingSession(t);

		await auth.mutation(onboardingApi.confirmIdentity, { sessionId });
		await auth.mutation(onboardingApi.submitLsoLicense, {
			barNumber: "L12345",
			jurisdiction: "ON",
			sessionId,
		});
		await auth.mutation(onboardingApi.completeMockIdv, { sessionId });
		await auth.mutation(onboardingApi.acceptRepresentationEngagement, {
			sessionId,
		});
		const completed = await auth.mutation(onboardingApi.completeSession, {
			sessionId,
		});

		expect(completed.status).toBe("complete");
		expect(completed.completedAt).toEqual(expect.any(Number));
		expect(completed.workosUserId).toBe("user_guest_lawyer");
		const access = await t.run((ctx) =>
			ctx.db
				.query("dealAccess")
				.withIndex("by_user_and_deal", (query) =>
					query.eq("userId", "user_guest_lawyer").eq("dealId", dealId)
				)
				.first()
		);
		const provisional = await t.run((ctx) =>
			ctx.db.get(provisionalAccessId as Id<"dealAccess">)
		);
		const verifications = await t.run((ctx) =>
			ctx.db
				.query("lawyerVerifications")
				.withIndex("by_deal_created", (query) => query.eq("dealId", dealId))
				.collect()
		);
		const engagement = await t.run((ctx) =>
			ctx.db
				.query("representationEngagements")
				.withIndex("by_deal", (query) => query.eq("dealId", dealId))
				.first()
		);

		expect(access).toMatchObject({
			role: "guest_lawyer",
			status: "active",
			userId: "user_guest_lawyer",
		});
		expect(provisional).toMatchObject({
			role: "guest_lawyer",
			status: "revoked",
			userId: normalizedEmail,
		});
		expect(verifications.map((row) => row.checkType).sort()).toEqual([
			"idv",
			"initial_lso",
			"manual_admin",
		]);
		expect(
			verifications.some((row) =>
				row.reasonCodes.includes("identity_confirmed")
			)
		).toBe(true);
		expect(
			verifications.find((row) => row.checkType === "manual_admin")
				?.sourceSnapshot
		).toMatchObject({
			authId: "user_guest_lawyer",
			invitationTargetEmail: normalizedEmail,
			source: "lawyer_onboarding_identity_confirmation",
		});
		expect(engagement).toMatchObject({
			lawyerAuthId: "user_guest_lawyer",
			provider: "manual_admin",
			status: "signed",
		});
	});

	it("progresses platform checkpoints to complete without a deal and activates the platform lawyer", async () => {
		const t = createHarness();
		const auth = t.withIdentity(
			lawyerIdentity({
				authId: "user_platform_pending",
				email: "platform.pending@example.test",
			})
		);
		const { invitationId, profileId } = await seedPendingPlatformInvitation(t);
		const started = await t.mutation(
			onboardingApi.startOrResumeForPlatformInvitationInternal,
			{
				invitationId,
			}
		);

		await auth.mutation(onboardingApi.confirmIdentity, {
			sessionId: started.session._id,
		});
		await auth.mutation(onboardingApi.submitLsoLicense, {
			barNumber: "L77777",
			jurisdiction: "ON",
			sessionId: started.session._id,
		});
		await auth.mutation(onboardingApi.completeMockIdv, {
			sessionId: started.session._id,
		});
		const accepted = await auth.mutation(
			onboardingApi.acceptRepresentationEngagement,
			{
				sessionId: started.session._id,
			}
		);
		const completed = await auth.mutation(onboardingApi.completeSession, {
			sessionId: started.session._id,
		});

		expect(accepted).toMatchObject({
			currentStep: "complete",
			status: "complete",
		});
		expect(completed).toMatchObject({
			completedAt: expect.any(Number),
			currentStep: "complete",
			nextRoute: "/lawyer",
			platformAgreementAcceptedAt: expect.any(Number),
			status: "complete",
			workosUserId: "user_platform_pending",
		});
		const rows = await t.run(async (ctx) => ({
			access: await ctx.db.query("dealAccess").collect(),
			engagements: await ctx.db.query("representationEngagements").collect(),
			invitation: await ctx.db.get(invitationId),
			profile: await ctx.db.get(profileId),
			verifications: await ctx.db
				.query("lawyerVerifications")
				.withIndex("by_profile_check_created", (query) =>
					query.eq("lawyerProfileId", profileId)
				)
				.collect(),
		}));

		expect(rows.access).toEqual([]);
		expect(rows.engagements).toEqual([]);
		expect(rows.invitation).toMatchObject({
			acceptedAt: expect.any(Number),
			onboardingSessionId: started.session._id,
			status: "accepted",
		});
		expect(rows.profile).toMatchObject({
			authId: "user_platform_pending",
			platformStatus: "active",
		});
		expect(rows.verifications.map((row) => row.checkType).sort()).toEqual([
			"idv",
			"initial_lso",
			"manual_admin",
		]);
		expect(rows.verifications.every((row) => row.dealId === undefined)).toBe(
			true
		);
	});

	it("does not rewrite invitation acceptedAt when completing onboarding", async () => {
		const t = createHarness();
		const auth = t.withIdentity(lawyerIdentity());
		const { invitationId } = await seedPendingGuestInvitation(t, {
			status: "accepted",
		});
		const started = await t.mutation(
			onboardingApi.startOrResumeForInvitationInternal,
			{
				invitationId,
			}
		);
		await t.run((ctx) =>
			ctx.db.patch(invitationId, {
				acceptedAt: NOW + 1,
				resolvedAuthId: "user_guest_lawyer",
				updatedAt: NOW + 1,
			})
		);
		await progressSessionToReadyForCompletion(auth, t, started.session._id);

		await auth.mutation(onboardingApi.completeSession, {
			sessionId: started.session._id,
		});
		const invitation = await t.run((ctx) => ctx.db.get(invitationId));

		expect(invitation).toMatchObject({
			acceptedAt: NOW + 1,
			status: "verified",
		});
	});

	it("rejects checkpoint mutations when the authenticated lawyer email mismatches the invitation", async () => {
		const t = createHarness();
		const auth = t.withIdentity(
			lawyerIdentity({
				authId: "user_wrong_lawyer",
				email: "wrong@example.test",
			})
		);
		const { sessionId } = await seedGuestOnboardingSession(t);

		await expect(
			auth.mutation(onboardingApi.confirmIdentity, {
				sessionId,
			})
		).rejects.toThrow(SESSION_EMAIL_MISMATCH_PATTERN);
		const session = await t.run((ctx) => ctx.db.get(sessionId));

		expect(session).toMatchObject({
			status: "auth_pending",
		});
		expect(session?.blockedReasonCodes).toBeUndefined();
	});

	it("allows the target lawyer to recover an email mismatch block", async () => {
		const t = createHarness();
		const rightLawyer = t.withIdentity(lawyerIdentity());
		const { sessionId } = await seedGuestOnboardingSession(t);

		await t.run((ctx) =>
			ctx.db.patch(sessionId, {
				blockedReasonCodes: ["email_mismatch"],
				status: "blocked",
				updatedAt: NOW + 1,
			})
		);
		const recovered = await rightLawyer.mutation(
			onboardingApi.confirmIdentity,
			{
				sessionId,
			}
		);

		expect(recovered.blockedReasonCodes).toBeUndefined();
		expect(recovered).toMatchObject({
			status: "lso_pending",
			workosUserId: "user_guest_lawyer",
		});
	});

	it("rejects LSO submissions that do not match selected lawyer evidence", async () => {
		const t = createHarness();
		const auth = t.withIdentity(lawyerIdentity());
		const { sessionId } = await seedGuestOnboardingSession(t);

		await auth.mutation(onboardingApi.confirmIdentity, { sessionId });
		await expect(
			auth.mutation(onboardingApi.submitLsoLicense, {
				barNumber: "WRONG123",
				jurisdiction: "ON",
				sessionId,
			})
		).rejects.toThrow(LSO_MISMATCH_PATTERN);
		const verifications = await t.run((ctx) =>
			ctx.db.query("lawyerVerifications").collect()
		);

		expect(verifications.map((row) => row.checkType)).toEqual(["manual_admin"]);
	});

	it("rejects restricted LSO registry rows before recording eligible evidence", async () => {
		const t = createHarness();
		const auth = t.withIdentity(lawyerIdentity());
		const lsoLawyerId = await t.run((ctx) =>
			ctx.db.insert("lsoLawyers", {
				barNumber: "L99999",
				displayName: "Restricted Riley",
				entitledToPractise: false,
				jurisdiction: "ON",
				licenseeType: "lawyer",
				licensingStatus: "suspended",
				normalizedName: "restricted riley",
				restrictionStatus: "suspended",
				source: "lso_import",
				sourceFetchedAt: NOW,
				sourceSnapshot: { source: "test_fixture" },
				updatedAt: NOW,
			})
		);
		const { dealId, sessionId } =
			await seedGuestOnboardingSessionWithSelectedLso(t, lsoLawyerId);

		await auth.mutation(onboardingApi.confirmIdentity, { sessionId });
		await expect(
			auth.mutation(onboardingApi.submitLsoLicense, {
				barNumber: "L99999",
				jurisdiction: "ON",
				sessionId,
			})
		).rejects.toThrow(LSO_NOT_SELECTABLE_PATTERN);
		const rows = await t.run(async (ctx) => ({
			access: await ctx.db
				.query("dealAccess")
				.withIndex("by_user_and_deal", (query) =>
					query.eq("userId", "user_guest_lawyer").eq("dealId", dealId)
				)
				.collect(),
			verifications: await ctx.db.query("lawyerVerifications").collect(),
		}));

		expect(rows.access).toEqual([]);
		expect(rows.verifications.map((row) => row.checkType)).toEqual([
			"manual_admin",
		]);
	});

	it("does not allow a lawyer to complete engagement before prior checkpoints", async () => {
		const t = createHarness();
		const auth = t.withIdentity(lawyerIdentity());
		const { sessionId } = await seedGuestOnboardingSession(t);

		await expect(
			auth.mutation(onboardingApi.acceptRepresentationEngagement, {
				sessionId,
			})
		).rejects.toThrow(IDV_CHECKPOINT_REQUIRED_PATTERN);
	});

	it("does not allow unauthenticated completion", async () => {
		const t = createHarness();
		const { sessionId } = await seedGuestOnboardingSession(t);

		await expect(
			t.mutation(onboardingApi.completeSession, { sessionId })
		).rejects.toThrow();
	});

	it("keeps non-lawyer identities out of owned checkpoints", async () => {
		const t = createHarness();
		const nonLawyer = t.withIdentity(nonLawyerIdentity());
		const { sessionId } = await seedGuestOnboardingSession(t);

		await expect(
			nonLawyer.mutation(onboardingApi.confirmIdentity, { sessionId })
		).rejects.toThrow(LAWYER_REQUIRED_PATTERN);
	});
});
