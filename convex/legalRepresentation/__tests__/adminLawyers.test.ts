import { anyApi } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it } from "vitest";
import {
	EXTERNAL_ORG_ADMIN,
	FAIRLEND_ADMIN,
} from "../../../src/test/auth/identities";
import { registerAuditLogComponent } from "../../../src/test/convex/registerAuditLogComponent";
import {
	setWorkosProvisioningForTests,
	type WorkosProvisioning,
} from "../../engine/effects/workosProvisioning";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";
import { normalizeLawyerEmail } from "../normalization";

const adminLawyersApi = anyApi.legalRepresentation.adminLawyers;
const SHA_256_EVIDENCE_HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

afterEach(() => {
	setWorkosProvisioningForTests(null);
});

function createHarness() {
	const t = convexTest(schema, convexModules);
	registerAuditLogComponent(t, "auditLog");
	return t;
}

async function seedLawyerRosterRows(t: ReturnType<typeof createHarness>) {
	return await t.run(async (ctx) => {
		const now = Date.UTC(2026, 4, 3);
		const brokerUserId = await ctx.db.insert("users", {
			authId: "broker_roster_seed",
			email: "broker@example.test",
			firstName: "Broker",
			lastName: "Seed",
		});
		const lenderUserId = await ctx.db.insert("users", {
			authId: "lender_roster_seed",
			email: "lender@example.test",
			firstName: "Lender",
			lastName: "Seed",
		});
		const brokerId = await ctx.db.insert("brokers", {
			createdAt: now,
			status: "active",
			userId: brokerUserId,
		});
		const lenderId = await ctx.db.insert("lenders", {
			accreditationStatus: "accredited",
			brokerId,
			createdAt: now,
			onboardingEntryPath: "test",
			status: "active",
			userId: lenderUserId,
		});
		const propertyId = await ctx.db.insert("properties", {
			city: "Toronto",
			createdAt: now,
			postalCode: "M5V 1A1",
			propertyType: "residential",
			province: "ON",
			streetAddress: "123 Legal Ops Ave",
		});
		const mortgageId = await ctx.db.insert("mortgages", {
			amortizationMonths: 300,
			brokerOfRecordId: brokerId,
			createdAt: now,
			firstPaymentDate: "2026-06-01",
			interestAdjustmentDate: "2026-05-01",
			interestRate: 9.5,
			lienPosition: 1,
			loanType: "conventional",
			maturityDate: "2031-05-01",
			paymentAmount: 2500,
			paymentFrequency: "monthly",
			principal: 500_000,
			propertyId,
			rateType: "fixed",
			status: "funded",
			termMonths: 60,
			termStartDate: "2026-05-01",
		});
		const dealId = await ctx.db.insert("deals", {
			buyerId: "lender_roster_seed",
			createdAt: now,
			createdBy: "system:test",
			fractionalShare: 1000,
			lawyerId: "guest@example.test",
			lawyerType: "guest_lawyer",
			lenderId,
			mortgageId,
			selectedLawyer: {
				email: "guest@example.test",
				firm: "Guest Law",
				name: "Guest Lawyer",
				source: "manual",
				type: "guest_lawyer",
			},
			sellerId: "seller_roster_seed",
			status: "lawyerOnboarding.pending",
		});
		const platformProfileId = await ctx.db.insert("lawyerProfiles", {
			authId: "user_platform_panel",
			barNumber: "LSO-100001",
			createdAt: now - 10_000,
			displayName: "Panel Lawyer",
			email: "panel@example.test",
			firmName: "Panel Law LLP",
			jurisdiction: "ON",
			normalizedEmail: "panel@example.test",
			platformStatus: "active",
			profileKind: "platform",
			updatedAt: now - 5000,
		});
		const guestProfileId = await ctx.db.insert("lawyerProfiles", {
			barNumber: "LSO-200002",
			createdAt: now - 20_000,
			displayName: "Guest Lawyer",
			email: "guest@example.test",
			firmName: "Guest Law",
			jurisdiction: "ON",
			normalizedEmail: "guest@example.test",
			profileKind: "guest",
			updatedAt: now - 15_000,
		});
		await ctx.db.insert("lawyerVerifications", {
			checkType: "manual_admin",
			createdAt: now - 9000,
			createdBy: "user_fairlend_admin",
			expiresAt: now + 86_400_000,
			lawyerProfileId: platformProfileId,
			normalizedEmail: "panel@example.test",
			outcome: "eligible",
			provider: "manual_admin",
			reasonCodes: ["active_license"],
			sourceSnapshot: { source: "manual_admin" },
		});
		await ctx.db.insert("lawyerInvitations", {
			createdAt: now - 8000,
			createdBy: "user_fairlend_admin",
			dealId,
			deliveredAt: now - 7000,
			deliveryProvider: "workos",
			deliveryStatus: "sent",
			expiresAt: now + 3_600_000,
			normalizedTargetEmail: normalizeLawyerEmail("guest@example.test"),
			selectedLawyerSnapshot: {
				email: "guest@example.test",
				firm: "Guest Law",
				name: "Guest Lawyer",
				source: "manual",
				type: "guest_lawyer",
			},
			status: "pending",
			targetEmail: "guest@example.test",
			tokenHash: "hash_guest",
			updatedAt: now - 7000,
		});
		return { dealId, guestProfileId, platformProfileId };
	});
}

async function seedOrphanedGuestLawyerEvidence(
	t: ReturnType<typeof createHarness>
) {
	return await t.run(async (ctx) => {
		const now = Date.UTC(2026, 4, 3);
		const brokerUserId = await ctx.db.insert("users", {
			authId: "broker_orphan_seed",
			email: "broker.orphan@example.test",
			firstName: "Broker",
			lastName: "Orphan",
		});
		const lenderUserId = await ctx.db.insert("users", {
			authId: "lender_orphan_seed",
			email: "lender.orphan@example.test",
			firstName: "Lender",
			lastName: "Orphan",
		});
		const brokerId = await ctx.db.insert("brokers", {
			createdAt: now,
			status: "active",
			userId: brokerUserId,
		});
		const lenderId = await ctx.db.insert("lenders", {
			accreditationStatus: "accredited",
			brokerId,
			createdAt: now,
			onboardingEntryPath: "test",
			status: "active",
			userId: lenderUserId,
		});
		const propertyId = await ctx.db.insert("properties", {
			city: "Toronto",
			createdAt: now,
			postalCode: "M5V 1A1",
			propertyType: "residential",
			province: "ON",
			streetAddress: "789 Orphan Ave",
		});
		const mortgageId = await ctx.db.insert("mortgages", {
			amortizationMonths: 300,
			brokerOfRecordId: brokerId,
			createdAt: now,
			firstPaymentDate: "2026-06-01",
			interestAdjustmentDate: "2026-05-01",
			interestRate: 9.5,
			lienPosition: 1,
			loanType: "conventional",
			maturityDate: "2031-05-01",
			paymentAmount: 2500,
			paymentFrequency: "monthly",
			principal: 500_000,
			propertyId,
			rateType: "fixed",
			status: "funded",
			termMonths: 60,
			termStartDate: "2026-05-01",
		});
		const lsoLawyerId = await ctx.db.insert("lsoLawyers", {
			barNumber: "L44444",
			displayName: "Olivia Orphan",
			entitledToPractise: true,
			jurisdiction: "ON",
			licenseeType: "lawyer",
			licensingStatus: "licensed",
			normalizedName: "olivia orphan",
			restrictionStatus: "clear",
			source: "lso_import",
			sourceFetchedAt: now,
			sourceSnapshot: { source: "test_fixture" },
			updatedAt: now,
		});
		const dealId = await ctx.db.insert("deals", {
			buyerId: "lender_orphan_seed",
			createdAt: now,
			createdBy: "system:test",
			fractionalShare: 1000,
			lawyerId: "user_orphan_guest_lawyer",
			lawyerType: "guest_lawyer",
			lenderId,
			mortgageId,
			selectedLawyer: {
				email: "orphan.guest@example.test",
				firm: "Orphan Law",
				lso: {
					barNumber: "L44444",
					jurisdiction: "ON",
					licensingStatus: "licensed",
					lsoLawyerId,
					restrictionStatus: "clear",
					source: "test_fixture",
					sourceFetchedAt: now,
				},
				name: "Olivia Orphan",
				source: "lso_search",
				type: "guest_lawyer",
			},
			sellerId: "seller_orphan_seed",
			status: "documentReview.pending",
		});
		const invitationId = await ctx.db.insert("lawyerInvitations", {
			acceptedAt: now - 5000,
			createdAt: now - 9000,
			createdBy: "system:test",
			dealId,
			deliveredAt: now - 8500,
			deliveryProvider: "workos",
			deliveryStatus: "sent",
			expiresAt: now + 86_400_000,
			lsoLawyerId,
			normalizedTargetEmail: "orphan.guest@example.test",
			resolvedAuthId: "user_orphan_guest_lawyer",
			selectedLawyerSnapshot: {
				email: "orphan.guest@example.test",
				firm: "Orphan Law",
				lso: {
					barNumber: "L44444",
					jurisdiction: "ON",
					licensingStatus: "licensed",
					lsoLawyerId,
					restrictionStatus: "clear",
					source: "test_fixture",
					sourceFetchedAt: now,
				},
				name: "Olivia Orphan",
				source: "lso_search",
				type: "guest_lawyer",
			},
			status: "verified",
			targetEmail: "orphan.guest@example.test",
			tokenHash: "hash_orphan",
			updatedAt: now - 1000,
			verifiedAt: now - 1000,
		});
		const sessionId = await ctx.db.insert("lawyerOnboardingSessions", {
			acceptedEngagementAt: now - 2000,
			authCompletedAt: now - 8000,
			completedAt: now - 1000,
			createdAt: now - 9000,
			currentStep: "complete",
			dealId,
			engagementAcceptedAt: now - 2000,
			identityConfirmedAt: now - 8000,
			idvCompletedAt: now - 4000,
			invitationId,
			lsoSubmittedAt: now - 7000,
			lsoVerifiedAt: now - 7000,
			nextRoute: `/deals/${String(dealId)}`,
			normalizedTargetEmail: "orphan.guest@example.test",
			path: "guest_invited",
			returnPath: `/deals/${String(dealId)}`,
			status: "complete",
			updatedAt: now - 1000,
			workosUserId: "user_orphan_guest_lawyer",
		});
		const verificationId = await ctx.db.insert("lawyerVerifications", {
			authId: "user_orphan_guest_lawyer",
			barNumber: "L44444",
			checkType: "initial_lso",
			createdAt: now - 7000,
			createdBy: `lawyer-onboarding:${String(sessionId)}`,
			dealId,
			expiresAt: now + 86_400_000,
			jurisdiction: "ON",
			lsoLawyerId,
			normalizedEmail: "orphan.guest@example.test",
			outcome: "eligible",
			provider: "lso",
			providerCompletedAt: now - 7000,
			providerReferenceId: "ON:L44444",
			providerStatus: "completed",
			reasonCodes: ["active_license"],
			sourceSnapshot: { source: "test_fixture" },
		});
		const engagementId = await ctx.db.insert("representationEngagements", {
			createdAt: now - 2000,
			dealId,
			evidenceHash: "sha256:orphan-engagement",
			lawyerAuthId: "user_orphan_guest_lawyer",
			provider: "manual_admin",
			signedAt: now - 2000,
			status: "signed",
			updatedAt: now - 2000,
		});
		await ctx.db.insert("dealAccess", {
			dealId,
			grantedAt: now - 1000,
			grantedBy: "lawyer-onboarding:test",
			role: "guest_lawyer",
			status: "active",
			userId: "user_orphan_guest_lawyer",
		});
		return { dealId, engagementId, sessionId, verificationId };
	});
}

describe("admin lawyer roster projection", () => {
	it("lists platform and guest lawyers with urgent rows first", async () => {
		const t = createHarness();
		await seedLawyerRosterRows(t);

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(adminLawyersApi.listLawyerRosterPage, {
				filters: { profileKind: "all", urgency: "all" },
				pagination: { cursor: null, pageSize: 25 },
				search: "",
				sort: "urgency",
			});

		expect(result.rows).toHaveLength(2);
		expect(
			result.rows.map((row: { profileKind: string }) => row.profileKind)
		).toEqual(["guest", "platform"]);
		expect(result.rows[0]).toMatchObject({
			email: "guest@example.test",
			urgency: "invitation_expiring",
		});
		expect(result.summary.invitationsExpiring).toBe(1);
	});

	it("projects roster identity, verification, invitation, and override-needed urgency signals", async () => {
		const t = createHarness();
		await seedLawyerRosterRows(t);
		const overrideProfileId = await t.run(async (ctx) => {
			const now = Date.UTC(2026, 4, 3);
			const profileId = await ctx.db.insert("lawyerProfiles", {
				barNumber: "LSO-303030",
				createdAt: now - 30_000,
				displayName: "Override Counsel",
				email: "override@example.test",
				firmName: "Override LLP",
				jurisdiction: "ON",
				normalizedEmail: "override@example.test",
				profileKind: "guest",
				updatedAt: now - 25_000,
			});
			const brokerUserId = await ctx.db.insert("users", {
				authId: "broker_override_seed",
				email: "broker.override@example.test",
				firstName: "Broker",
				lastName: "Override",
			});
			const lenderUserId = await ctx.db.insert("users", {
				authId: "lender_override_seed",
				email: "lender.override@example.test",
				firstName: "Lender",
				lastName: "Override",
			});
			const brokerId = await ctx.db.insert("brokers", {
				createdAt: now,
				status: "active",
				userId: brokerUserId,
			});
			const lenderId = await ctx.db.insert("lenders", {
				accreditationStatus: "accredited",
				brokerId,
				createdAt: now,
				onboardingEntryPath: "test",
				status: "active",
				userId: lenderUserId,
			});
			const propertyId = await ctx.db.insert("properties", {
				city: "Toronto",
				createdAt: now,
				postalCode: "M5V 1A1",
				propertyType: "residential",
				province: "ON",
				streetAddress: "456 Override Ave",
			});
			const mortgageId = await ctx.db.insert("mortgages", {
				amortizationMonths: 300,
				brokerOfRecordId: brokerId,
				createdAt: now,
				firstPaymentDate: "2026-06-01",
				interestAdjustmentDate: "2026-05-01",
				interestRate: 9.5,
				lienPosition: 1,
				loanType: "conventional",
				maturityDate: "2031-05-01",
				paymentAmount: 2500,
				paymentFrequency: "monthly",
				principal: 500_000,
				propertyId,
				rateType: "fixed",
				status: "funded",
				termMonths: 60,
				termStartDate: "2026-05-01",
			});
			await ctx.db.insert("deals", {
				buyerId: "lender_override_seed",
				createdAt: now,
				createdBy: "system:test",
				fractionalShare: 1000,
				lawyerId: "override@example.test",
				lawyerType: "guest_lawyer",
				lenderId,
				mortgageId,
				selectedLawyer: {
					email: "override@example.test",
					firm: "Override LLP",
					name: "Override Counsel",
					source: "manual",
					type: "guest_lawyer",
				},
				sellerId: "seller_override_seed",
				status: "lawyerOnboarding.verified",
			});
			return profileId;
		});

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(adminLawyersApi.listLawyerRosterPage, {
				filters: { profileKind: "all", urgency: "all" },
				pagination: { cursor: null, pageSize: 25 },
				search: "",
				sort: "urgency",
			});
		const guestRow = result.rows.find(
			(row: { email: string }) => row.email === "guest@example.test"
		);
		const overrideRow = result.rows.find(
			(row: { profileId: unknown }) => row.profileId === overrideProfileId
		);

		expect(guestRow).toMatchObject({
			activeInvitation: {
				status: "pending",
				targetEmail: "guest@example.test",
			},
			barNumber: "LSO-200002",
			jurisdiction: "ON",
		});
		expect(guestRow.latestVerification).toBeNull();
		expect(overrideRow).toMatchObject({
			nextAction: "Verify representation",
			urgency: "representation_override_needed",
		});
	});

	it("rejects roster reads from non-FairLend admins", async () => {
		const t = createHarness();

		await expect(
			t
				.withIdentity(EXTERNAL_ORG_ADMIN)
				.query(adminLawyersApi.listLawyerRosterPage, {
					filters: { profileKind: "all", urgency: "all" },
					pagination: { cursor: null, pageSize: 25 },
					search: "",
					sort: "urgency",
				})
		).rejects.toThrow("Forbidden: fair lend admin role required");
	});

	it("surfaces and repairs orphaned guest lawyer identity evidence", async () => {
		const t = createHarness();
		const orphan = await seedOrphanedGuestLawyerEvidence(t);

		const beforeRoster = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(adminLawyersApi.listLawyerRosterPage, {
				filters: { profileKind: "all", urgency: "all" },
				pagination: { cursor: null, pageSize: 25 },
				search: "",
				sort: "urgency",
			});
		const repairQueue = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(adminLawyersApi.listLawyerProfileRepairQueue, {});

		expect(beforeRoster.rows).toHaveLength(1);
		expect(beforeRoster.rows[0]).toMatchObject({
			displayName: "Olivia Orphan",
			email: "orphan.guest@example.test",
			identityRepair: {
				totalEvidenceRecords: 5,
			},
			identityStatus: "missing_profile",
			profileId: null,
			urgency: "pending_onboarding",
		});
		expect(repairQueue.summary).toMatchObject({
			orphanedCandidates: 1,
			totalEvidenceRecords: 5,
		});
		expect(repairQueue.candidates[0]).toMatchObject({
			authId: "user_orphan_guest_lawyer",
			barNumber: "L44444",
			displayName: "Olivia Orphan",
			email: "orphan.guest@example.test",
			firmName: "Orphan Law",
			jurisdiction: "ON",
			recordCounts: {
				deals: 1,
				engagements: 1,
				invitations: 1,
				onboardingSessions: 1,
				verifications: 1,
			},
		});

		const repaired = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(adminLawyersApi.repairLawyerProfileIdentity, {
				repairKey: repairQueue.candidates[0].repairKey,
			});
		const after = await t.run(async (ctx) => ({
			engagement: await ctx.db.get(orphan.engagementId),
			session: await ctx.db.get(orphan.sessionId),
			verification: await ctx.db.get(orphan.verificationId),
		}));
		const afterRoster = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(adminLawyersApi.listLawyerRosterPage, {
				filters: { profileKind: "all", urgency: "all" },
				pagination: { cursor: null, pageSize: 25 },
				search: "",
				sort: "urgency",
			});

		expect(repaired).toMatchObject({
			linkedCounts: {
				engagements: 1,
				onboardingSessions: 1,
				verifications: 1,
			},
		});
		expect(typeof repaired.profileId).toBe("string");
		const repairedProfileId = repaired.profileId;
		expect(after.session?.lawyerProfileId).toBe(repairedProfileId);
		expect(after.verification?.lawyerProfileId).toBe(repairedProfileId);
		expect(after.engagement?.lawyerProfileId).toBe(repairedProfileId);
		expect(afterRoster.rows).toHaveLength(1);
		expect(afterRoster.rows[0]).toMatchObject({
			activeDealCount: 1,
			email: "orphan.guest@example.test",
			profileId: repairedProfileId,
			profileKind: "guest",
		});
	});

	it("surfaces deal-scoped guest invitations before a lawyer profile exists", async () => {
		const t = createHarness();
		const { guestProfileId } = await seedLawyerRosterRows(t);
		await t.run(async (ctx) => {
			await ctx.db.delete(guestProfileId);
		});

		const roster = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(adminLawyersApi.listLawyerRosterPage, {
				filters: { profileKind: "all", urgency: "all" },
				pagination: { cursor: null, pageSize: 25 },
				search: "guest@example.test",
				sort: "latest_activity",
			});

		expect(roster.rows).toHaveLength(1);
		expect(roster.rows[0]).toMatchObject({
			activeDealCount: 1,
			displayName: "Guest Lawyer",
			email: "guest@example.test",
			identityStatus: "missing_profile",
			invitationStatus: "pending",
			profileId: null,
		});
		expect(roster.summary.identityRepairs).toBe(1);
	});

	it("counts active lawyer deal access separately from accepted deal invitations", async () => {
		const t = createHarness();
		const { dealId } = await seedLawyerRosterRows(t);
		await t.run(async (ctx) => {
			await ctx.db.insert("users", {
				authId: "user_guest_accepted_lawyer",
				email: "guest@example.test",
				firstName: "Guest",
				lastName: "Lawyer",
			});
			await ctx.db.patch(dealId, {
				lawyerId: "legacy-invite-target@example.test",
				status: "fundsTransfer.pending",
			});
			const invitation = await ctx.db
				.query("lawyerInvitations")
				.withIndex("by_deal", (query) => query.eq("dealId", dealId))
				.first();
			if (invitation) {
				await ctx.db.patch(invitation._id, {
					acceptedAt: Date.UTC(2026, 4, 3),
					resolvedAuthId: "user_guest_accepted_lawyer",
					status: "verified",
					updatedAt: Date.UTC(2026, 4, 3),
					verifiedAt: Date.UTC(2026, 4, 3),
				});
			}
			await ctx.db.insert("dealAccess", {
				dealId,
				grantedAt: Date.UTC(2026, 4, 3),
				grantedBy: "test",
				role: "guest_lawyer",
				status: "active",
				userId: "user_guest_accepted_lawyer",
			});
		});

		const roster = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(adminLawyersApi.listLawyerRosterPage, {
				filters: { profileKind: "all", urgency: "all" },
				pagination: { cursor: null, pageSize: 25 },
				search: "guest@example.test",
				sort: "latest_activity",
			});

		expect(roster.rows[0]).toMatchObject({
			activeDealCount: 1,
			displayName: "Guest Lawyer",
			invitationStatus: "verified",
			pastDealCount: 0,
			pendingDealInviteCount: 0,
		});
	});

	it("hydrates auth-only repair candidates from synced users", async () => {
		const t = createHarness();
		const { dealId } = await seedLawyerRosterRows(t);
		await t.run(async (ctx) => {
			await ctx.db.insert("users", {
				authId: "user_auth_only_lawyer",
				email: "auth.only@example.test",
				firstName: "Auth",
				lastName: "Only",
			});
			await ctx.db.insert("representationEngagements", {
				createdAt: Date.UTC(2026, 4, 4),
				dealId,
				lawyerAuthId: "user_auth_only_lawyer",
				provider: "manual_admin",
				status: "signed",
				updatedAt: Date.UTC(2026, 4, 4),
			});
		});

		const roster = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(adminLawyersApi.listLawyerRosterPage, {
				filters: { profileKind: "all", urgency: "all" },
				pagination: { cursor: null, pageSize: 25 },
				search: "auth.only@example.test",
				sort: "latest_activity",
			});

		expect(roster.rows[0]).toMatchObject({
			displayName: "Auth Only",
			email: "auth.only@example.test",
			identityStatus: "missing_profile",
		});
	});

	it("previews and manually repairs missing lawyer identity outcomes", async () => {
		const t = createHarness();
		await seedOrphanedGuestLawyerEvidence(t);
		const repairQueue = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(adminLawyersApi.listLawyerProfileRepairQueue, {});

		const preview = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(adminLawyersApi.getLawyerProfileRepairPreview, {
				repairKey: repairQueue.candidates[0].repairKey,
			});

		expect(preview).toMatchObject({
			canAutoRepair: true,
			suggestedProfile: {
				displayName: "Olivia Orphan",
				email: "orphan.guest@example.test",
				jurisdiction: "ON",
			},
		});
		expect(preview.evidenceRecords.length).toBeGreaterThan(0);

		const repaired = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(adminLawyersApi.repairLawyerProfileIdentity, {
				overrides: {
					displayName: "Olivia Manual",
					email: "manual.orphan@example.test",
					firmName: "Manual Law",
				},
				repairKey: repairQueue.candidates[0].repairKey,
			});

		const profile = await t.run(async (ctx) => ctx.db.get(repaired.profileId));
		expect(profile).toMatchObject({
			displayName: "Olivia Manual",
			email: "manual.orphan@example.test",
			firmName: "Manual Law",
		});
	});
});

describe("admin lawyer detail projection and actions", () => {
	it("lets admins update lawyer profile record fields from the detail surface", async () => {
		const t = createHarness();
		const { guestProfileId } = await seedLawyerRosterRows(t);

		await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(adminLawyersApi.updateLawyerProfileAdmin, {
				barNumber: "lso 999",
				displayName: "Guest Legal Updated",
				email: "Guest.Updated@Example.Test",
				firmName: "Updated Law",
				jurisdiction: "on",
				profileId: guestProfileId,
			});
		const profile = await t.run(async (ctx) => ctx.db.get(guestProfileId));

		expect(profile).toMatchObject({
			barNumber: "LSO999",
			displayName: "Guest Legal Updated",
			email: "Guest.Updated@Example.Test",
			firmName: "Updated Law",
			jurisdiction: "ON",
			normalizedEmail: "guest.updated@example.test",
		});
	});

	it("lets admins attach missing LSO evidence to an existing lawyer profile", async () => {
		const t = createHarness();
		const { guestProfileId } = await seedLawyerRosterRows(t);
		const lsoLawyerId = await t.run(async (ctx) =>
			ctx.db.insert("lsoLawyers", {
				barNumber: "L200002",
				displayName: "Guest Lawyer",
				entitledToPractise: true,
				jurisdiction: "ON",
				licenseeType: "lawyer",
				licensingStatus: "licensed",
				normalizedName: "guest lawyer",
				restrictionStatus: "clear",
				source: "lso_import",
				sourceFetchedAt: Date.UTC(2026, 4, 3),
				sourceSnapshot: { source: "test_fixture" },
				updatedAt: Date.UTC(2026, 4, 3),
			})
		);

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(adminLawyersApi.repairLawyerProfileLsoLink, {
				lsoLawyerId,
				profileId: guestProfileId,
			});
		const rows = await t.run(async (ctx) => {
			const profile = await ctx.db.get(guestProfileId);
			const verification = profile?.latestVerificationId
				? await ctx.db.get(profile.latestVerificationId)
				: null;
			return { profile, verification };
		});

		expect(result).toMatchObject({ lsoLawyerId, profileId: guestProfileId });
		expect(rows.verification).toMatchObject({
			lawyerProfileId: guestProfileId,
			lsoLawyerId,
			outcome: "eligible",
			provider: "manual_admin",
		});
		expect(rows.profile?.latestVerificationId).toBe(rows.verification?._id);
	});

	it("returns detail sections for a selected lawyer profile", async () => {
		const t = createHarness();
		const { guestProfileId } = await seedLawyerRosterRows(t);

		const detail = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(adminLawyersApi.getLawyerAdminDetail, {
				profileId: guestProfileId,
			});

		expect(detail.profile.email).toBe("guest@example.test");
		expect(detail.invitations.active).toHaveLength(1);
		expect(detail.allowedActions.resendInvitation).toBe(true);
		expect(detail.actionTargets).toEqual({
			replacementDealId: detail.deals.active[0]._id,
			representationDealId: detail.deals.active[0]._id,
		});
		expect(detail.deals.active).toHaveLength(1);
	});

	it("returns platform ops, availability, and activity detail records", async () => {
		const t = createHarness();
		const { platformProfileId } = await seedLawyerRosterRows(t);
		const { platformInvitationId, platformSessionId } = await t.run(
			async (ctx) => {
				const now = Date.UTC(2026, 4, 3);
				const tierId = await ctx.db.insert("platformLawyerSlaTiers", {
					createdAt: now,
					createdBy: "user_fairlend_admin",
					description: "Standard review",
					name: "Standard",
					reviewHours: 24,
					status: "active",
					updatedAt: now,
					updatedBy: "user_fairlend_admin",
				});
				await ctx.db.insert("platformLawyerAssignments", {
					capacityLimit: 4,
					createdAt: now,
					createdBy: "user_fairlend_admin",
					lawyerProfileId: platformProfileId,
					nextRestrictionRecheckAt: now + 86_400_000,
					recheckIntervalDays: 30,
					slaTierId: tierId,
					updatedAt: now,
					updatedBy: "user_fairlend_admin",
				});
				await ctx.db.insert("platformLawyerAvailabilityWindows", {
					createdAt: now,
					createdBy: "user_fairlend_admin",
					dayOfWeek: 1,
					endMinute: 1020,
					lawyerProfileId: platformProfileId,
					startMinute: 540,
					status: "active",
					timezone: "America/Toronto",
					updatedAt: now,
					updatedBy: "user_fairlend_admin",
				});
				await ctx.db.insert("platformLawyerAvailabilityExceptions", {
					businessDate: "2026-05-04",
					createdAt: now,
					createdBy: "user_fairlend_admin",
					kind: "hold",
					lawyerProfileId: platformProfileId,
					reason: "Closing volume",
					updatedAt: now,
					updatedBy: "user_fairlend_admin",
				});
				const platformInvitationId = await ctx.db.insert(
					"platformLawyerInvitations",
					{
						barNumber: "LSO-100001",
						createdAt: now - 2000,
						createdBy: "user_fairlend_admin",
						deliveredAt: now - 1000,
						deliveryStatus: "sent",
						displayName: "Panel Lawyer",
						email: "panel@example.test",
						firmName: "Panel Law LLP",
						jurisdiction: "ON",
						lawyerProfileId: platformProfileId,
						normalizedEmail: "panel@example.test",
						status: "sent",
						updatedAt: now - 1000,
						workosInvitationId: "workos_panel_invitation",
					}
				);
				const platformSessionId = await ctx.db.insert(
					"lawyerOnboardingSessions",
					{
						createdAt: now - 500,
						currentStep: "lso",
						identityConfirmedAt: now - 400,
						lawyerProfileId: platformProfileId,
						nextRoute: "/lawyer/onboarding/platform-panel",
						normalizedTargetEmail: "panel@example.test",
						path: "platform_application",
						platformLawyerInvitationId: platformInvitationId,
						returnPath: "/lawyer",
						status: "lso_pending",
						updatedAt: now - 400,
						workosUserId: "user_platform_panel",
					}
				);
				return { platformInvitationId, platformSessionId };
			}
		);

		const detail = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(adminLawyersApi.getLawyerAdminDetail, {
				profileId: platformProfileId,
			});

		expect(detail.platform.assignment.capacityLimit).toBe(4);
		expect(detail.platform.availability.windows).toHaveLength(1);
		expect(detail.platform.availability.exceptions).toHaveLength(1);
		expect(detail.platform.invitations.active[0]).toMatchObject({
			_id: platformInvitationId,
			status: "sent",
		});
		expect(detail.platform.onboardingSessions.active[0]).toMatchObject({
			_id: platformSessionId,
			status: "lso_pending",
		});
		expect(detail.activity.events.length).toBeGreaterThan(0);
	});

	it("resolves platform invite emails against synced users and existing profiles", async () => {
		const t = createHarness();
		await t.run(async (ctx) => {
			await ctx.db.insert("users", {
				authId: "user_synced_platform_lawyer",
				email: "synced.platform@example.test",
				firstName: "Synced",
				lastName: "Lawyer",
			});
			await ctx.db.insert("lawyerProfiles", {
				createdAt: Date.UTC(2026, 4, 3),
				displayName: "Guest Synced",
				email: "synced.platform@example.test",
				normalizedEmail: "synced.platform@example.test",
				profileKind: "guest",
				updatedAt: Date.UTC(2026, 4, 3),
			});
		});

		const resolution = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(adminLawyersApi.resolvePlatformLawyerInvite, {
				email: "synced.platform@example.test",
			});

		expect(resolution).toMatchObject({
			recommendedAction: "attach_existing_user",
			user: { authId: "user_synced_platform_lawyer" },
		});
	});

	it("resolves synced WorkOS users beyond the first fallback page", async () => {
		const t = createHarness();
		await t.run(async (ctx) => {
			for (let index = 0; index < 105; index += 1) {
				await ctx.db.insert("users", {
					authId: `user_filler_${index}`,
					email: `filler-${index}@example.test`,
					firstName: "Filler",
					lastName: String(index),
				});
			}
			await ctx.db.insert("users", {
				authId: "user_late_case_synced_platform_lawyer",
				email: "Late.Case.Platform@Example.Test",
				firstName: "Late",
				lastName: "Case",
			});
		});

		const resolution = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(adminLawyersApi.resolvePlatformLawyerInvite, {
				email: "late.case.platform@example.test",
			});

		expect(resolution).toMatchObject({
			recommendedAction: "attach_existing_user",
			user: { authId: "user_late_case_synced_platform_lawyer" },
		});
	});

	it("attaches synced users and creates pending platform onboarding invites for new people", async () => {
		const t = createHarness();
		await t.run(async (ctx) => {
			await ctx.db.insert("users", {
				authId: "user_attach_platform_lawyer",
				email: "attach.platform@example.test",
				firstName: "Attach",
				lastName: "Lawyer",
			});
		});

		const attached = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(adminLawyersApi.invitePlatformLawyer, {
				barNumber: "LSO-777777",
				displayName: "Attach Lawyer",
				email: "attach.platform@example.test",
				firmName: "Attach LLP",
				jurisdiction: "ON",
				resolution: "attach_existing_user",
			});
		const pending = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(adminLawyersApi.invitePlatformLawyer, {
				barNumber: "LSO-888888",
				deliverViaWorkos: false,
				displayName: "Pending Lawyer",
				email: "pending.platform@example.test",
				firmName: "Pending LLP",
				jurisdiction: "ON",
				resolution: "create_pending",
			});

		expect(attached).toMatchObject({
			action: "attached_existing_user",
			deliveryStatus: "not_sent",
		});
		expect(pending).toMatchObject({
			action: "created_pending_invite",
			deliveryStatus: "pending",
		});
		const roster = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(adminLawyersApi.listLawyerRosterPage, {
				filters: { profileKind: "all", urgency: "all" },
				pagination: { cursor: null, pageSize: 25 },
				search: "pending.platform@example.test",
				sort: "latest_activity",
			});
		expect(roster.rows[0]).toMatchObject({
			displayName: "Pending Lawyer",
			identityStatus: "linked",
			invitationStatus: "pending",
			platformStatus: "invited",
			profileKind: "platform",
		});
	});

	it("rejects caller-supplied auth IDs that do not match the resolved WorkOS user", async () => {
		const t = createHarness();
		await t.run(async (ctx) => {
			await ctx.db.insert("users", {
				authId: "user_correct_platform_lawyer",
				email: "correct.platform@example.test",
				firstName: "Correct",
				lastName: "Lawyer",
			});
		});

		await expect(
			t
				.withIdentity(FAIRLEND_ADMIN)
				.mutation(adminLawyersApi.invitePlatformLawyer, {
					authId: "user_wrong_platform_lawyer",
					barNumber: "LSO-777888",
					displayName: "Correct Lawyer",
					email: "correct.platform@example.test",
					firmName: "Correct LLP",
					jurisdiction: "ON",
					resolution: "attach_existing_user",
				})
		).rejects.toThrow("Provided authId does not match WorkOS identity");
	});

	it("reserves platform invitation delivery before sending through WorkOS", async () => {
		const t = createHarness();
		let releaseSend: () => void = () => undefined;
		let sendStarted: () => void = () => undefined;
		const sendStartedPromise = new Promise<void>((resolve) => {
			sendStarted = resolve;
		});
		const releaseSendPromise = new Promise<void>((resolve) => {
			releaseSend = resolve;
		});
		const sentEmails: string[] = [];
		setWorkosProvisioningForTests({
			sendInvitation: async (input: { email: string }) => {
				sentEmails.push(input.email);
				sendStarted();
				await releaseSendPromise;
				return {
					acceptInvitationUrl: "https://workos.example/accept",
					email: input.email,
					id: "workos_platform_reserved",
					state: "pending",
				};
			},
		} as unknown as WorkosProvisioning);
		const invitationId = await t.run(async (ctx) => {
			const now = Date.UTC(2026, 4, 3);
			const profileId = await ctx.db.insert("lawyerProfiles", {
				createdAt: now,
				displayName: "Reserved Platform",
				email: "reserved.platform@example.test",
				normalizedEmail: "reserved.platform@example.test",
				platformStatus: "invited",
				profileKind: "platform",
				updatedAt: now,
			});
			return await ctx.db.insert("platformLawyerInvitations", {
				createdAt: now,
				createdBy: FAIRLEND_ADMIN.subject,
				deliveryStatus: "pending",
				displayName: "Reserved Platform",
				email: "reserved.platform@example.test",
				lawyerProfileId: profileId,
				normalizedEmail: "reserved.platform@example.test",
				status: "pending",
				updatedAt: now,
			});
		});

		const firstDelivery = t.action(
			adminLawyersApi.deliverPlatformLawyerInvitation,
			{
				invitationId,
			}
		);
		await sendStartedPromise;
		const reserved = await t.run(async (ctx) => ctx.db.get(invitationId));
		const secondDelivery = await t.action(
			adminLawyersApi.deliverPlatformLawyerInvitation,
			{ invitationId }
		);
		releaseSend();
		const delivered = await firstDelivery;

		expect(reserved).toMatchObject({
			deliveryStatus: "sending",
			status: "pending",
		});
		expect(secondDelivery).toEqual({ status: "skipped" });
		expect(delivered).toMatchObject({
			status: "sent",
			workosInvitationId: "workos_platform_reserved",
		});
		expect(sentEmails).toEqual(["reserved.platform@example.test"]);
	});

	it("keeps representation override evidence enforced by the canonical management mutation", async () => {
		const t = createHarness();
		const { dealId } = await seedLawyerRosterRows(t);

		await expect(
			t
				.withIdentity(FAIRLEND_ADMIN)
				.mutation(
					anyApi.legalRepresentation.management
						.adminOverrideRepresentationConfirmation,
					{
						attachmentIds: [],
						dealId,
						evidenceNote: " ",
						reason: "Admin reviewed signed engagement.",
					}
				)
		).rejects.toThrow("Override evidence note is required");
	});

	it("lets admins verify representation with explicit signed engagement evidence", async () => {
		const t = createHarness();
		const previousHashchain = process.env.DISABLE_GT_HASHCHAIN;
		process.env.DISABLE_GT_HASHCHAIN = "true";
		const { dealId } = await seedLawyerRosterRows(t);
		await t.run(async (ctx) => {
			await ctx.db.patch(dealId, { status: "lawyerOnboarding.verified" });
			await ctx.db.insert("dealAccess", {
				dealId,
				grantedAt: Date.UTC(2026, 4, 3),
				grantedBy: "test",
				role: "guest_lawyer",
				status: "active",
				userId: "guest@example.test",
			});
			await ctx.db.insert("lawyerVerifications", {
				authId: "guest@example.test",
				checkType: "manual_admin",
				createdAt: Date.now(),
				createdBy: "user_fairlend_admin",
				expiresAt: Date.now() + 86_400_000,
				normalizedEmail: "guest@example.test",
				outcome: "eligible",
				provider: "manual_admin",
				reasonCodes: ["active_license"],
				sourceSnapshot: { source: "manual_admin" },
			});
		});

		try {
			const result = await t
				.withIdentity(FAIRLEND_ADMIN)
				.mutation(
					anyApi.legalRepresentation.management
						.adminVerifyRepresentationConfirmation,
					{
						attachmentIds: [],
						dealId,
						evidenceNote: "Signed retainer reviewed by legal ops.",
						reason: "Admin verified signed representation evidence.",
					}
				);

			expect(result.engagementId).toBeTruthy();
			expect(result.transition.success).toBe(true);
			const engagement = await t.run(async (ctx) =>
				ctx.db.get(result.engagementId)
			);
			expect(engagement?.evidenceHash).toMatch(SHA_256_EVIDENCE_HASH_PATTERN);
		} finally {
			if (previousHashchain === undefined) {
				process.env.DISABLE_GT_HASHCHAIN = undefined;
			} else {
				process.env.DISABLE_GT_HASHCHAIN = previousHashchain;
			}
		}
	});

	it("rejects canonical representation override actions from non-admin callers", async () => {
		const t = createHarness();
		const { dealId } = await seedLawyerRosterRows(t);

		await expect(
			t
				.withIdentity(EXTERNAL_ORG_ADMIN)
				.mutation(
					anyApi.legalRepresentation.management
						.adminOverrideRepresentationConfirmation,
					{
						attachmentIds: [],
						dealId,
						evidenceNote: "Signed retainer reviewed.",
						reason: "Admin reviewed signed engagement.",
					}
				)
		).rejects.toThrow("Forbidden: fair lend admin role required");
	});
});
