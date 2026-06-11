import { anyApi } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FAIRLEND_ADMIN } from "../../../src/test/auth/identities";
import { registerAuditLogComponent } from "../../../src/test/convex/registerAuditLogComponent";
import type { Id } from "../../_generated/dataModel";
import {
	setWorkosProvisioningForTests,
	type WorkosProvisioning,
} from "../../engine/effects/workosProvisioning";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";
import { normalizeLawyerEmail } from "../normalization";
import { buildManualLawyerVerificationResult } from "../providers";
import { recordLawyerVerificationRow } from "../verifications";

const NOW = 4_000_000_000_000;
const invitationsApi = anyApi.legalRepresentation.invitations;
const managementApi = anyApi.legalRepresentation.management;
const workosInvitationsApi = anyApi.legalRepresentation.workosInvitations;
const dealQueriesApi = anyApi.deals.queries;

let originalDisableGtHashchain: string | undefined;
let originalSkipWorkosInvitationDelivery: string | undefined;
let originalSkipWorkosInvitationRevoke: string | undefined;

beforeEach(() => {
	originalDisableGtHashchain = process.env.DISABLE_GT_HASHCHAIN;
	originalSkipWorkosInvitationDelivery =
		process.env.SKIP_WORKOS_INVITATION_DELIVERY;
	originalSkipWorkosInvitationRevoke =
		process.env.SKIP_WORKOS_INVITATION_REVOKE;
	process.env.DISABLE_GT_HASHCHAIN = "true";
	process.env.SKIP_WORKOS_INVITATION_DELIVERY = "true";
	process.env.SKIP_WORKOS_INVITATION_REVOKE = "true";
});

afterEach(() => {
	setWorkosProvisioningForTests(null);
	if (originalDisableGtHashchain === undefined) {
		Reflect.deleteProperty(process.env, "DISABLE_GT_HASHCHAIN");
	} else {
		process.env.DISABLE_GT_HASHCHAIN = originalDisableGtHashchain;
	}
	if (originalSkipWorkosInvitationDelivery === undefined) {
		Reflect.deleteProperty(process.env, "SKIP_WORKOS_INVITATION_DELIVERY");
	} else {
		process.env.SKIP_WORKOS_INVITATION_DELIVERY =
			originalSkipWorkosInvitationDelivery;
	}
	if (originalSkipWorkosInvitationRevoke === undefined) {
		Reflect.deleteProperty(process.env, "SKIP_WORKOS_INVITATION_REVOKE");
	} else {
		process.env.SKIP_WORKOS_INVITATION_REVOKE =
			originalSkipWorkosInvitationRevoke;
	}
});

function installWorkosManagementCapture() {
	const sentInvitations: Array<{
		email: string;
		organizationId?: string;
		roleSlug?: string;
	}> = [];
	const resentInvitationIds: string[] = [];
	const revokedInvitationIds: string[] = [];
	const provisioning = {
		createOrganization: async () => ({ id: "org_unused" }),
		createOrganizationMembership: async () => ({ id: "om_unused" }),
		createUser: async (args: { email: string }) => ({
			email: args.email,
			id: "user_unused",
		}),
		findInvitationByToken: async (token: string) => ({
			email: "riley.guest@example.test",
			id: `workos_${token}`,
			state: "pending",
			token,
		}),
		listUsers: async () => [],
		resendInvitation: async (invitationId: string) => {
			resentInvitationIds.push(invitationId);
			return {
				email: "riley.guest@example.test",
				id: invitationId,
				state: "pending",
			};
		},
		revokeInvitation: async (invitationId: string) => {
			revokedInvitationIds.push(invitationId);
			return {
				email: "riley.guest@example.test",
				id: invitationId,
				state: "revoked",
			};
		},
		sendInvitation: async (args: {
			email: string;
			organizationId?: string;
			roleSlug?: string;
		}) => {
			sentInvitations.push(args);
			return {
				email: args.email,
				id: `workos_management_${sentInvitations.length}`,
				state: "pending",
				token: `workos_management_token_${sentInvitations.length}`,
			};
		},
	} as unknown as WorkosProvisioning;
	setWorkosProvisioningForTests(provisioning);
	return { resentInvitationIds, revokedInvitationIds, sentInvitations };
}

function createHarness() {
	const t = convexTest(schema, convexModules);
	registerAuditLogComponent(t, "auditLog");
	return t;
}

function lenderIdentity() {
	return {
		subject: "lender-auth",
		issuer: "https://api.workos.com",
		org_id: "org_lender",
		organization_name: "FairLend Investor",
		role: "member",
		roles: JSON.stringify(["member"]),
		permissions: JSON.stringify(["deal:view"]),
		user_email: "lender@example.test",
		user_email_verified: true,
		user_first_name: "Lena",
		user_last_name: "Lender",
	};
}

function unrelatedLenderIdentity() {
	return {
		...lenderIdentity(),
		subject: "unrelated-lender-auth",
		user_email: "unrelated-lender@example.test",
		user_first_name: "Una",
		user_last_name: "Unrelated",
	};
}

async function insertGuestDeal(
	t: ReturnType<typeof createHarness>,
	args?: {
		readonly dealStatus?: string;
		readonly targetEmail?: string;
	}
) {
	return await t.run(async (ctx) => {
		const targetEmail = args?.targetEmail ?? "riley.guest@example.test";
		const normalizedEmail = normalizeLawyerEmail(targetEmail);
		const brokerUserId = await ctx.db.insert("users", {
			authId: "broker-auth",
			email: "broker@example.test",
			firstName: "Broker",
			lastName: "User",
		});
		const lenderUserId = await ctx.db.insert("users", {
			authId: "lender-auth",
			email: "lender@example.test",
			firstName: "Lena",
			lastName: "Lender",
		});
		await ctx.db.insert("users", {
			authId: "seller-auth",
			email: "seller@example.test",
			firstName: "Sam",
			lastName: "Seller",
		});
		const propertyId = await ctx.db.insert("properties", {
			city: "Toronto",
			createdAt: NOW,
			postalCode: "M5V 1A1",
			propertyType: "residential",
			province: "ON",
			streetAddress: "123 Management St",
		});
		const brokerId = await ctx.db.insert("brokers", {
			createdAt: NOW,
			status: "active",
			userId: brokerUserId,
		});
		const lenderId = await ctx.db.insert("lenders", {
			accreditationStatus: "accredited",
			brokerId,
			createdAt: NOW,
			onboardingEntryPath: "test",
			status: "active",
			userId: lenderUserId,
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
			buyerId: "lender-auth",
			createdAt: NOW,
			createdBy: "system:test",
			fractionalShare: 2500,
			lawyerId: normalizedEmail,
			lawyerType: "guest_lawyer",
			lenderId,
			mortgageId,
			selectedLawyer: {
				type: "guest_lawyer",
				source: "manual",
				name: "Riley Guest",
				email: targetEmail,
				firm: "Guest Legal",
			},
			sellerId: "seller-auth",
			status: args?.dealStatus ?? "lawyerOnboarding.pending",
		});
		const lenderAccessId = await ctx.db.insert("dealAccess", {
			dealId,
			grantedAt: NOW,
			grantedBy: "system:test",
			role: "lender",
			status: "active",
			userId: "lender-auth",
		});
		const lawyerAccessId = await ctx.db.insert("dealAccess", {
			dealId,
			grantedAt: NOW,
			grantedBy: "system:test",
			role: "guest_lawyer",
			status: "active",
			userId: normalizedEmail,
		});
		return {
			dealId,
			lawyerAccessId,
			lenderAccessId,
			lenderUserId,
			normalizedEmail,
		};
	});
}

async function seedEligibleGuestVerification(
	t: ReturnType<typeof createHarness>,
	args: {
		readonly dealId: Id<"deals">;
		readonly lawyerAuthId: string;
	}
) {
	return await t.run(async (ctx) => {
		return await recordLawyerVerificationRow(ctx, {
			authId: args.lawyerAuthId,
			checkType: "manual_admin",
			createdAt: NOW,
			createdBy: "system:test",
			dealId: args.dealId,
			normalizedEmail: args.lawyerAuthId,
			providerResult: buildManualLawyerVerificationResult({
				evidenceHash: `sha256:test-verification:${args.lawyerAuthId}`,
				expiresAt: NOW + 30 * 24 * 60 * 60 * 1000,
				outcome: "eligible",
				reasonCodes: ["active_license"],
				sourceSnapshot: { source: "management-test" },
			}),
		});
	});
}

async function seedDocumentAsset(
	t: ReturnType<typeof createHarness>,
	args: {
		readonly name: string;
		readonly uploadedByUserId: Id<"users">;
	}
) {
	return await t.run(async (ctx) => {
		const fileRef = await (
			ctx.storage as unknown as {
				store: (blob: Blob) => Promise<Id<"_storage">>;
			}
		).store(new Blob([args.name], { type: "application/pdf" }));
		return await ctx.db.insert("documentAssets", {
			description: "Admin override representation evidence",
			fileHash: `${args.name}:hash`,
			fileRef,
			fileSize: 128,
			mimeType: "application/pdf",
			name: args.name,
			originalFilename: args.name,
			pageCount: 1,
			source: "admin_upload",
			uploadedAt: NOW,
			uploadedByUserId: args.uploadedByUserId,
		});
	});
}

describe("legal representation management", () => {
	it("projects pending guest invitation status through participant deal workspace", async () => {
		const t = createHarness();
		const { dealId } = await insertGuestDeal(t);
		await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(invitationsApi.createGuestInvitationForDeal, {
				dealId,
				now: NOW,
			});

		const workspace = await t
			.withIdentity(lenderIdentity())
			.query(dealQueriesApi.getParticipantDealWorkspace, {
				dealId,
				persona: "purchasing_lender",
			});

		expect(workspace?.legalRepresentation).toMatchObject({
			kind: "guest_invitation_sent",
			label: "Guest invitation sent",
			showInDealViews: true,
		});
		expect(
			workspace?.legalRepresentation.actions.resendInvitation.allowed
		).toBe(true);
		expect(
			workspace?.legalRepresentation.actions.changeGuestEmail.allowed
		).toBe(true);
	});

	it("lets the lender resend a pending invite without extending expiry", async () => {
		const t = createHarness();
		const workos = installWorkosManagementCapture();
		const { dealId } = await insertGuestDeal(t);
		const created = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(invitationsApi.createGuestInvitationForDeal, {
				dealId,
				deliverViaWorkos: true,
				now: NOW,
				ttlMs: 72 * 60 * 60 * 1000,
			});
		await t.action(workosInvitationsApi.deliverGuestInvitation, {
			invitationId: created.invitationId,
		});
		const original = await t.run(async (ctx) =>
			ctx.db.get(created.invitationId)
		);

		const resent = await t
			.withIdentity(lenderIdentity())
			.mutation(managementApi.resendLegalRepresentationInvitation, {
				dealId,
				now: NOW + 60_000,
			});
		await t.action(workosInvitationsApi.resendGuestInvitationDelivery, {
			invitationId: resent.invitationId,
		});
		const rows = await t.run(async (ctx) => ({
			auditEvents: await ctx.db.query("auditJournal").collect(),
			invitations: await ctx.db.query("lawyerInvitations").collect(),
			newInvitation: await ctx.db.get(resent.invitationId),
		}));

		expect(resent.token).not.toBe(created.token);
		expect(rows.newInvitation?.expiresAt).toBe(original?.expiresAt);
		expect(rows.newInvitation).toMatchObject({
			deliveryProvider: "workos",
			deliveryStatus: "sent",
			workosInvitationId: "workos_management_1",
		});
		expect(workos.resentInvitationIds).toEqual(["workos_management_1"]);
		expect(
			rows.invitations.find((row) => row._id === created.invitationId)
		).toMatchObject({ status: "revoked" });
		expect(rows.auditEvents).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					actorId: "lender-auth",
					eventType: "LEGAL_REPRESENTATION_INVITATION_RESENT",
				}),
			])
		);
	});

	it("lets the lender send the first guest invitation when the deal has no invitation row", async () => {
		const t = createHarness();
		const workos = installWorkosManagementCapture();
		const { dealId } = await insertGuestDeal(t);

		const before = await t
			.withIdentity(lenderIdentity())
			.query(dealQueriesApi.getParticipantDealWorkspace, {
				dealId,
				persona: "purchasing_lender",
			});
		expect(before?.legalRepresentation.currentInvitation).toMatchObject({
			status: "none",
		});
		expect(before?.legalRepresentation.actions.resendInvitation.allowed).toBe(
			true
		);

		const sent = await t
			.withIdentity(lenderIdentity())
			.mutation(managementApi.resendLegalRepresentationInvitation, {
				dealId,
				now: NOW + 60_000,
			});
		await t.action(workosInvitationsApi.deliverGuestInvitation, {
			invitationId: sent.invitationId,
		});
		const rows = await t.run(async (ctx) => ({
			auditEvents: await ctx.db.query("auditJournal").collect(),
			invitations: await ctx.db.query("lawyerInvitations").collect(),
			newInvitation: await ctx.db.get(sent.invitationId),
		}));

		expect(workos.sentInvitations).toEqual([
			expect.objectContaining({
				email: "riley.guest@example.test",
			}),
		]);
		expect(workos.resentInvitationIds).toEqual([]);
		expect(rows.invitations).toHaveLength(1);
		expect(rows.newInvitation).toMatchObject({
			deliveryProvider: "workos",
			deliveryStatus: "sent",
			status: "pending",
			targetEmail: "riley.guest@example.test",
			workosInvitationId: "workos_management_1",
		});
		expect(rows.auditEvents).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					actorId: "lender-auth",
					eventType: "LEGAL_REPRESENTATION_INVITATION_RESENT",
				}),
			])
		);
	});

	it("denies lawyer management to lenders without deal access", async () => {
		const t = createHarness();
		const { dealId } = await insertGuestDeal(t);
		await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(invitationsApi.createGuestInvitationForDeal, {
				dealId,
				deliverViaWorkos: true,
				now: NOW,
			});

		await expect(
			t
				.withIdentity(unrelatedLenderIdentity())
				.mutation(managementApi.resendLegalRepresentationInvitation, {
					dealId,
					now: NOW + 1,
				})
		).rejects.toThrow("Forbidden: no deal access");
	});

	it("rejects stale pending invitation actions after expiry", async () => {
		const t = createHarness();
		const { dealId } = await insertGuestDeal(t);
		await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(invitationsApi.createGuestInvitationForDeal, {
				dealId,
				now: NOW,
				ttlMs: 1000,
			});

		await expect(
			t
				.withIdentity(lenderIdentity())
				.mutation(managementApi.changeLegalRepresentationGuestEmail, {
					dealId,
					newEmail: "stale@example.test",
					now: NOW + 2000,
				})
		).rejects.toThrow("Expired guest invitations cannot be managed");
	});

	it("changes guest email by revoking old invitation/access and issuing a new target", async () => {
		const t = createHarness();
		const workos = installWorkosManagementCapture();
		const { dealId, lawyerAccessId } = await insertGuestDeal(t);
		const created = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(invitationsApi.createGuestInvitationForDeal, {
				dealId,
				deliverViaWorkos: true,
				now: NOW,
			});
		await t.action(workosInvitationsApi.deliverGuestInvitation, {
			invitationId: created.invitationId,
		});

		const changed = await t
			.withIdentity(lenderIdentity())
			.mutation(managementApi.changeLegalRepresentationGuestEmail, {
				dealId,
				newEmail: "new.riley@example.test",
				now: NOW + 1,
			});
		await t.action(workosInvitationsApi.deliverGuestInvitation, {
			invitationId: changed.invitationId,
		});
		const rows = await t.run(async (ctx) => ({
			auditEvents: await ctx.db.query("auditJournal").collect(),
			deal: await ctx.db.get(dealId),
			newAccess: await ctx.db.get(changed.accessId),
			newInvitation: await ctx.db.get(changed.invitationId),
			oldAccess: await ctx.db.get(lawyerAccessId),
			oldInvitation: await ctx.db.get(created.invitationId),
		}));

		expect(rows.oldAccess).toMatchObject({ status: "revoked" });
		expect(rows.oldInvitation).toMatchObject({ status: "revoked" });
		expect(rows.newAccess).toMatchObject({
			role: "guest_lawyer",
			status: "active",
			userId: "new.riley@example.test",
		});
		expect(rows.newInvitation).toMatchObject({
			deliveryProvider: "workos",
			deliveryStatus: "sent",
			normalizedTargetEmail: "new.riley@example.test",
			status: "pending",
			workosInvitationId: "workos_management_2",
		});
		expect(workos.revokedInvitationIds).toEqual([]);
		expect(workos.sentInvitations).toEqual([
			expect.objectContaining({ email: "riley.guest@example.test" }),
			expect.objectContaining({ email: "new.riley@example.test" }),
		]);
		expect(rows.deal).toMatchObject({
			lawyerId: "new.riley@example.test",
			lawyerType: "guest_lawyer",
		});
		expect(rows.auditEvents).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					actorId: "lender-auth",
					eventType: "LEGAL_REPRESENTATION_GUEST_EMAIL_CHANGED",
				}),
			])
		);
	});

	it("replaces a lawyer before verification and rejects replacement after verification", async () => {
		const t = createHarness();
		const { dealId, lawyerAccessId } = await insertGuestDeal(t);
		const created = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(invitationsApi.createGuestInvitationForDeal, {
				dealId,
				now: NOW,
			});
		const duplicateAccessId = await t.run(async (ctx) => {
			const extraAccessId = await ctx.db.insert("dealAccess", {
				dealId,
				grantedAt: NOW,
				grantedBy: "system:test-race",
				role: "guest_lawyer",
				status: "active",
				userId: "duplicate-lawyer@example.test",
			});
			await ctx.db.insert("representationEngagements", {
				createdAt: NOW,
				dealId,
				lawyerAuthId: "riley.guest@example.test",
				provider: "manual_admin",
				status: "pending",
				updatedAt: NOW,
			});
			return extraAccessId;
		});

		const replaced = await t
			.withIdentity(lenderIdentity())
			.mutation(managementApi.replaceLegalRepresentationLawyer, {
				dealId,
				newSelectedLawyer: {
					email: "platform@example.test",
					lawyerId: "platform-lawyer-auth",
					name: "Pat Platform",
					type: "platform_lawyer",
				},
				now: NOW + 1,
			});
		const rows = await t.run(async (ctx) => ({
			accessRows: await ctx.db
				.query("dealAccess")
				.withIndex("by_deal", (query) => query.eq("dealId", dealId))
				.collect(),
			deal: await ctx.db.get(dealId),
			engagements: await ctx.db
				.query("representationEngagements")
				.withIndex("by_deal", (query) => query.eq("dealId", dealId))
				.collect(),
			invitation: await ctx.db.get(created.invitationId),
			extraAccess: await ctx.db.get(duplicateAccessId),
			oldAccess: await ctx.db.get(lawyerAccessId),
		}));

		expect(rows.oldAccess).toMatchObject({ status: "revoked" });
		expect(rows.extraAccess).toMatchObject({ status: "revoked" });
		expect(rows.invitation).toMatchObject({ status: "revoked" });
		expect(rows.engagements).toEqual([
			expect.objectContaining({ status: "voided" }),
		]);
		expect(rows.accessRows.filter((row) => row.status === "active")).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ role: "lender", userId: "lender-auth" }),
				expect.objectContaining({
					role: "platform_lawyer",
					userId: "platform-lawyer-auth",
				}),
			])
		);
		expect(rows.deal).toMatchObject({
			lawyerId: "platform-lawyer-auth",
			lawyerType: "platform_lawyer",
		});
		expect(replaced.invitation).toBeNull();

		await t.run(async (ctx) => {
			await ctx.db.patch(dealId, { status: "lawyerOnboarding.verified" });
		});
		await expect(
			t
				.withIdentity(lenderIdentity())
				.mutation(managementApi.replaceLegalRepresentationLawyer, {
					dealId,
					newSelectedLawyer: {
						email: "another@example.test",
						lawyerId: "another-lawyer-auth",
						name: "Another Lawyer",
						type: "platform_lawyer",
					},
					now: NOW + 2,
				})
		).rejects.toThrow(
			"Lawyer management is only available before lawyer verification completes"
		);
	});

	it("lets admins override representation confirmation by writing evidence before the governed transition", async () => {
		const t = createHarness();
		const targetEmail = "Riley.Guest@Example.TEST";
		const { dealId, lenderUserId, normalizedEmail } = await insertGuestDeal(t, {
			dealStatus: "lawyerOnboarding.verified",
			targetEmail,
		});
		await t.run(async (ctx) => {
			await ctx.db.patch(dealId, { lawyerId: targetEmail });
		});
		await seedEligibleGuestVerification(t, {
			dealId,
			lawyerAuthId: normalizedEmail,
		});
		const attachmentId = await seedDocumentAsset(t, {
			name: "representation-override.pdf",
			uploadedByUserId: lenderUserId,
		});

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(managementApi.adminOverrideRepresentationConfirmation, {
				attachmentIds: [attachmentId],
				dealId,
				evidenceNote: "  signed engagement received by email  ",
				reason: "  borrower lawyer confirmed outside portal  ",
			});
		const rows = await t.run(async (ctx) => ({
			auditEvents: await ctx.db.query("auditJournal").collect(),
			deal: await ctx.db.get(dealId),
			engagement: await ctx.db.get(result.engagementId),
			overrideEvidence: await ctx.db.get(result.overrideEvidenceId),
		}));
		const workspace = await t
			.withIdentity(lenderIdentity())
			.query(dealQueriesApi.getParticipantDealWorkspace, {
				dealId,
				persona: "purchasing_lender",
			});

		expect(rows.deal).toMatchObject({
			status: "documentReview.pending",
		});
		expect(rows.overrideEvidence).toMatchObject({
			adminActorId: FAIRLEND_ADMIN.subject,
			attachmentIds: [attachmentId],
			dealId,
			engagementId: result.engagementId,
			evidenceNote: "signed engagement received by email",
			reason: "borrower lawyer confirmed outside portal",
			selectedLawyerSnapshot: {
				email: targetEmail,
				name: "Riley Guest",
				type: "guest_lawyer",
			},
			transitionJournalEntryId: result.transition.journalEntryId,
		});
		expect(rows.engagement).toMatchObject({
			dealId,
			evidenceHash: `sha256:admin-override:${result.overrideEvidenceId}`,
			lawyerAuthId: normalizedEmail,
			provider: "manual_admin",
			status: "signed",
		});
		expect(rows.auditEvents).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					eventCategory: "governed_transition",
					eventType: "REPRESENTATION_CONFIRMED",
					newState: "documentReview.pending",
					previousState: "lawyerOnboarding.verified",
				}),
			])
		);
		expect(workspace?.legalRepresentation.overrideEvidence).toMatchObject({
			attachmentCount: 1,
			engagementId: result.engagementId,
			hasAttachments: true,
			overrideEvidenceId: result.overrideEvidenceId,
			transitionJournalEntryId: result.transition.journalEntryId,
		});
	});

	it("rejects admin representation override for non-admin callers", async () => {
		const t = createHarness();
		const { dealId, normalizedEmail } = await insertGuestDeal(t, {
			dealStatus: "lawyerOnboarding.verified",
		});
		await seedEligibleGuestVerification(t, {
			dealId,
			lawyerAuthId: normalizedEmail,
		});

		await expect(
			t
				.withIdentity(lenderIdentity())
				.mutation(managementApi.adminOverrideRepresentationConfirmation, {
					dealId,
					evidenceNote: "signed engagement received by email",
					reason: "borrower lawyer confirmed outside portal",
				})
		).rejects.toThrow("Forbidden: fair lend admin role required");
	});

	it("rejects admin representation override unless the deal is lawyer verified", async () => {
		const t = createHarness();
		const { dealId, normalizedEmail } = await insertGuestDeal(t, {
			dealStatus: "lawyerOnboarding.pending",
		});
		await seedEligibleGuestVerification(t, {
			dealId,
			lawyerAuthId: normalizedEmail,
		});

		await expect(
			t
				.withIdentity(FAIRLEND_ADMIN)
				.mutation(managementApi.adminOverrideRepresentationConfirmation, {
					dealId,
					evidenceNote: "signed engagement received by email",
					reason: "borrower lawyer confirmed outside portal",
				})
		).rejects.toThrow(
			"Admin representation override requires deal status lawyerOnboarding.verified"
		);
	});
});
