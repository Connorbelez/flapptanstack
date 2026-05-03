import { anyApi } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import {
	EXTERNAL_ORG_ADMIN,
	FAIRLEND_ADMIN,
} from "../../../src/test/auth/identities";
import { registerAuditLogComponent } from "../../../src/test/convex/registerAuditLogComponent";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";
import { normalizeLawyerEmail } from "../normalization";

const adminLawyersApi = anyApi.legalRepresentation.adminLawyers;

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
});

describe("admin lawyer detail projection and actions", () => {
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
				createdAt: Date.UTC(2026, 4, 3),
				createdBy: "user_fairlend_admin",
				expiresAt: Date.UTC(2026, 4, 10),
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
