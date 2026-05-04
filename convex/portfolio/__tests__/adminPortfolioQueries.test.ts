import { anyApi } from "convex/server";
import { describe, expect, it } from "vitest";
import { FAIRLEND_ADMIN, LENDER } from "../../../src/test/auth/identities";
import {
	createHarness,
	createPortfolioFixture,
} from "../../../src/test/convex/portfolio-fixtures";
import { registerAuditLogComponent } from "../../../src/test/convex/registerAuditLogComponent";

const adminPortfolioApi = anyApi.admin.portfolio.queries;
const adminPortfolioMutations = anyApi.admin.portfolio.mutations;
const portalPortfolioApi = anyApi.portfolio.queries;
const FAIRLEND_ADMIN_ERROR = /fair lend admin/i;
const MISSING_AUTH_ERROR = /missing auth/i;
const MISSING_LENDER_ERROR = /lender record not found/i;
const MISSING_PORTAL_CONTEXT_ERROR =
	/admin portfolio broker context missing|admin portfolio target lender missing home portal/i;

describe("admin lender portfolio queries", () => {
	it("returns the same command-center portfolio contract as the lender portal", async () => {
		const t = createHarness();
		const ids = await createPortfolioFixture(t);

		const lenderPortfolio = await t
			.withIdentity(LENDER)
			.query(portalPortfolioApi.getLenderPortfolioCommandCenter, {
				portalId: ids.portalId,
			});
		const adminPortfolio = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(adminPortfolioApi.getAdminLenderPortfolioCommandCenter, {
				targetLenderId: ids.lenderId,
			});

		expect(adminPortfolio.cockpit.metrics).toMatchObject(
			lenderPortfolio.cockpit.metrics
		);
		expect(adminPortfolio.positions.rows).toEqual(
			lenderPortfolio.positions.rows
		);
		expect(adminPortfolio.paymentActivity.rows).toEqual(
			lenderPortfolio.paymentActivity.rows
		);
		expect(adminPortfolio.suggestedOpportunities.rows).toEqual(
			lenderPortfolio.suggestedOpportunities.rows
		);
	});

	it("resolves admin position and payment details for the target lender only", async () => {
		const t = createHarness();
		const ids = await createPortfolioFixture(t);
		const obligationId = await t.run(async (ctx) => {
			const mortgage = await ctx.db.get(ids.mortgageId);
			if (!mortgage) {
				throw new Error("Expected portfolio fixture mortgage");
			}
			const borrowerUserId = await ctx.db.insert("users", {
				authId: "user_admin_portfolio_borrower",
				email: "admin-portfolio-borrower@fairlend.ca",
				firstName: "Admin",
				lastName: "Portfolio Borrower",
			});
			const borrowerId = await ctx.db.insert("borrowers", {
				createdAt: Date.UTC(2026, 0, 15),
				lastTransitionAt: undefined,
				orgId: mortgage.orgId,
				portalId: ids.portalId,
				status: "active",
				userId: borrowerUserId,
			});
			return await ctx.db.insert("obligations", {
				amount: 125_000,
				amountSettled: 0,
				borrowerId,
				createdAt: Date.UTC(2026, 0, 15),
				dueDate: Date.UTC(2026, 1, 1),
				feeCode: undefined,
				gracePeriodEnd: Date.UTC(2026, 1, 5),
				lastTransitionAt: undefined,
				machineContext: undefined,
				mortgageFeeId: undefined,
				mortgageId: ids.mortgageId,
				orgId: mortgage.orgId,
				paymentNumber: 1,
				postingGroupId: undefined,
				settledAt: undefined,
				sourceObligationId: undefined,
				status: "upcoming",
				type: "regular_interest",
			});
		});

		const [lenderPosition, adminPosition, lenderPayment, adminPayment] =
			await Promise.all([
				t
					.withIdentity(LENDER)
					.query(portalPortfolioApi.getLenderPortfolioPositionDetail, {
						mortgageId: ids.mortgageId,
						portalId: ids.portalId,
					}),
				t
					.withIdentity(FAIRLEND_ADMIN)
					.query(adminPortfolioApi.getAdminLenderPortfolioPositionDetail, {
						mortgageId: ids.mortgageId,
						targetLenderId: ids.lenderId,
					}),
				t
					.withIdentity(LENDER)
					.query(portalPortfolioApi.getLenderPortfolioPaymentDetail, {
						obligationId,
						portalId: ids.portalId,
					}),
				t
					.withIdentity(FAIRLEND_ADMIN)
					.query(adminPortfolioApi.getAdminLenderPortfolioPaymentDetail, {
						obligationId,
						targetLenderId: ids.lenderId,
					}),
			]);

		expect(adminPosition.position).toEqual(lenderPosition.position);
		expect(adminPayment.payment).toEqual(lenderPayment.payment);
	});

	it("fails closed for missing lender, missing auth user, missing broker portal, and non-admin callers", async () => {
		const t = createHarness();
		const ids = await createPortfolioFixture(t);

		await expect(
			t
				.withIdentity(LENDER)
				.query(adminPortfolioApi.getAdminLenderPortfolioCommandCenter, {
					targetLenderId: ids.lenderId,
				})
		).rejects.toThrow(FAIRLEND_ADMIN_ERROR);

		const deletedLenderId = await t.run(async (ctx) => {
			const lender = await ctx.db.get(ids.lenderId);
			if (!lender) {
				throw new Error("Expected lender fixture");
			}
			const { _creationTime, _id, ...lenderInsert } = lender;
			const insertedId = await ctx.db.insert("lenders", {
				...lenderInsert,
				createdAt: lender.createdAt + 1,
			});
			await ctx.db.delete(insertedId);
			return insertedId;
		});
		await expect(
			t
				.withIdentity(FAIRLEND_ADMIN)
				.query(adminPortfolioApi.getAdminLenderPortfolioCommandCenter, {
					targetLenderId: deletedLenderId,
				})
		).rejects.toThrow(MISSING_LENDER_ERROR);

		await t.run(async (ctx) => {
			const lender = await ctx.db.get(ids.lenderId);
			if (!lender) {
				throw new Error("Expected lender fixture");
			}
			await ctx.db.delete(lender.userId);
		});
		await expect(
			t
				.withIdentity(FAIRLEND_ADMIN)
				.query(adminPortfolioApi.getAdminLenderPortfolioCommandCenter, {
					targetLenderId: ids.lenderId,
				})
		).rejects.toThrow(MISSING_AUTH_ERROR);
	});

	it("resolves the target lender home portal instead of another active broker portal", async () => {
		const t = createHarness();
		const ids = await createPortfolioFixture(t);

		await t.run(async (ctx) => {
			const portal = await ctx.db.get(ids.portalId);
			if (!portal) {
				throw new Error("Expected portfolio fixture portal");
			}
			const { _creationTime, _id, ...portalInsert } = portal;
			await ctx.db.insert("portals", {
				...portalInsert,
				localHost: "other-portfolio.localhost:3000",
				productionHost: "other-portfolio.fairlend.ca",
				slug: "other-portfolio",
				updatedAt: portal.updatedAt + 1,
			});
		});

		await expect(
			t
				.withIdentity(FAIRLEND_ADMIN)
				.query(adminPortfolioApi.getAdminLenderPortfolioCommandCenter, {
					targetLenderId: ids.lenderId,
				})
		).resolves.toMatchObject({
			cockpit: {
				metrics: expect.any(Object),
			},
		});

		await t.run(async (ctx) => {
			await ctx.db.patch(ids.portalId, {
				status: "suspended",
			});
		});
		await expect(
			t
				.withIdentity(FAIRLEND_ADMIN)
				.query(adminPortfolioApi.getAdminLenderPortfolioCommandCenter, {
					targetLenderId: ids.lenderId,
				})
		).rejects.toThrow(MISSING_PORTAL_CONTEXT_ERROR);
	});

	it("fails closed before admin renewal mutation when target portal context is unavailable", async () => {
		const t = createHarness();
		const ids = await createPortfolioFixture(t);

		await t.run(async (ctx) => {
			await ctx.db.patch(ids.portalId, {
				isPublished: false,
			});
		});

		await expect(
			t
				.withIdentity(FAIRLEND_ADMIN)
				.mutation(adminPortfolioMutations.signalAdminLenderRenewalIntent, {
					intent: "renew",
					mortgageId: ids.mortgageId,
					reason: "Backoffice lender portfolio test",
					targetLenderId: ids.lenderId,
				})
		).rejects.toThrow(MISSING_PORTAL_CONTEXT_ERROR);
	});

	it("signals renewal intent as the target lender while auditing the admin actor", async () => {
		const t = createHarness();
		registerAuditLogComponent(t, "auditLog");
		const ids = await createPortfolioFixture(t);
		const intentId = await t.run(async (ctx) => {
			const lender = await ctx.db.get(ids.lenderId);
			const mortgage = await ctx.db.get(ids.mortgageId);
			const account = await ctx.db
				.query("ledger_accounts")
				.withIndex("by_mortgage", (query) =>
					query.eq("mortgageId", ids.mortgageId)
				)
				.first();
			if (!(lender && mortgage && account)) {
				throw new Error("Expected portfolio renewal fixture records");
			}
			return await ctx.db.insert("lenderRenewalIntents", {
				borrowerRenewalIntentId: undefined,
				brokerAcknowledgedAt: undefined,
				brokerId: mortgage.brokerOfRecordId,
				brokerNotes: undefined,
				createdAt: Date.now(),
				fractionCount: 10,
				intent: undefined,
				lastTransitionAt: undefined,
				lenderId: ids.lenderId,
				machineContext: undefined,
				maturityDate: Date.now() + 45 * 24 * 60 * 60 * 1000,
				mortgageId: ids.mortgageId,
				notes: undefined,
				partialExitFractions: undefined,
				positionAccountId: String(account._id),
				signalDeadline: Date.now() + 30 * 24 * 60 * 60 * 1000,
				signalledAt: undefined,
				status: "pending_signal",
			});
		});

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(adminPortfolioMutations.signalAdminLenderRenewalIntent, {
				intent: "renew",
				mortgageId: ids.mortgageId,
				reason: "Backoffice lender portfolio test",
				targetLenderId: ids.lenderId,
			});

		expect(result.intent).toBe("renew");
		const journal = await t.run(async (ctx) =>
			ctx.db
				.query("auditJournal")
				.withIndex("by_entity", (query) =>
					query.eq("entityType", "lenderRenewalIntent").eq("entityId", intentId)
				)
				.first()
		);
		expect(journal).toMatchObject({
			actorId: FAIRLEND_ADMIN.subject,
			actorType: "admin",
			channel: "admin_dashboard",
			eventType: "LENDER_SIGNALS_RENEW",
			outcome: "transitioned",
		});
		expect(journal?.payload).toMatchObject({
			adminActorAuthId: FAIRLEND_ADMIN.subject,
			reason: "Backoffice lender portfolio test",
			sourceRoute: "admin_lender_portfolio",
			targetLenderId: String(ids.lenderId),
		});
	});

	it("audits patch-only admin renewal intent updates with admin metadata", async () => {
		const t = createHarness();
		registerAuditLogComponent(t, "auditLog");
		const ids = await createPortfolioFixture(t);
		const intentId = await t.run(async (ctx) => {
			const mortgage = await ctx.db.get(ids.mortgageId);
			const account = await ctx.db
				.query("ledger_accounts")
				.withIndex("by_mortgage", (query) =>
					query.eq("mortgageId", ids.mortgageId)
				)
				.first();
			if (!(mortgage && account)) {
				throw new Error("Expected portfolio renewal fixture records");
			}
			return await ctx.db.insert("lenderRenewalIntents", {
				borrowerRenewalIntentId: undefined,
				brokerAcknowledgedAt: undefined,
				brokerId: mortgage.brokerOfRecordId,
				brokerNotes: undefined,
				createdAt: Date.now(),
				fractionCount: 10,
				intent: "exit",
				lastTransitionAt: Date.now(),
				lenderId: ids.lenderId,
				machineContext: undefined,
				maturityDate: Date.now() + 45 * 24 * 60 * 60 * 1000,
				mortgageId: ids.mortgageId,
				notes: "Original exit",
				partialExitFractions: undefined,
				positionAccountId: String(account._id),
				signalDeadline: Date.now() + 30 * 24 * 60 * 60 * 1000,
				signalledAt: Date.now(),
				status: "exiting",
			});
		});

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(adminPortfolioMutations.signalAdminLenderRenewalIntent, {
				intent: "partial_exit",
				mortgageId: ids.mortgageId,
				partialExitFractions: 500,
				reason: "Client requested half exit after call",
				targetLenderId: ids.lenderId,
			});

		expect(result.intent).toBe("partial_exit");
		const journals = await t.run(async (ctx) =>
			ctx.db
				.query("auditJournal")
				.withIndex("by_entity", (query) =>
					query.eq("entityType", "lenderRenewalIntent").eq("entityId", intentId)
				)
				.collect()
		);
		const patchJournal = journals.find(
			(journal) => journal.eventType === "LENDER_UPDATES_PARTIAL_EXIT_INTENT"
		);
		expect(patchJournal).toMatchObject({
			actorId: FAIRLEND_ADMIN.subject,
			actorType: "admin",
			channel: "admin_dashboard",
			eventCategory: "governed_transition",
			outcome: "transitioned",
		});
		expect(patchJournal?.payload).toMatchObject({
			adminActorAuthId: FAIRLEND_ADMIN.subject,
			partialExitFractions: 500,
			reason: "Client requested half exit after call",
			sourceRoute: "admin_lender_portfolio",
			targetLenderId: String(ids.lenderId),
		});
	});
});
