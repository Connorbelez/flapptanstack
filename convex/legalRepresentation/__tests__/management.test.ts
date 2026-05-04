import { anyApi } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { FAIRLEND_ADMIN } from "../../../src/test/auth/identities";
import { registerAuditLogComponent } from "../../../src/test/convex/registerAuditLogComponent";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";
import { normalizeLawyerEmail } from "../normalization";

const NOW = 4_000_000_000_000;
const invitationsApi = anyApi.legalRepresentation.invitations;
const managementApi = anyApi.legalRepresentation.management;
const dealQueriesApi = anyApi.deals.queries;

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
			normalizedEmail,
		};
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
				persona: "buyer",
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
		const { dealId } = await insertGuestDeal(t);
		const created = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(invitationsApi.createGuestInvitationForDeal, {
				dealId,
				now: NOW,
				ttlMs: 72 * 60 * 60 * 1000,
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
		const rows = await t.run(async (ctx) => ({
			auditEvents: await ctx.db.query("auditJournal").collect(),
			invitations: await ctx.db.query("lawyerInvitations").collect(),
			newInvitation: await ctx.db.get(resent.invitationId),
		}));

		expect(resent.token).not.toBe(created.token);
		expect(rows.newInvitation?.expiresAt).toBe(original?.expiresAt);
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

	it("denies lawyer management to lenders without deal access", async () => {
		const t = createHarness();
		const { dealId } = await insertGuestDeal(t);
		await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(invitationsApi.createGuestInvitationForDeal, {
				dealId,
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
		const { dealId, lawyerAccessId } = await insertGuestDeal(t);
		const created = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(invitationsApi.createGuestInvitationForDeal, {
				dealId,
				now: NOW,
			});

		const changed = await t
			.withIdentity(lenderIdentity())
			.mutation(managementApi.changeLegalRepresentationGuestEmail, {
				dealId,
				newEmail: "new.riley@example.test",
				now: NOW + 1,
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
			normalizedTargetEmail: "new.riley@example.test",
			status: "pending",
		});
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
});
