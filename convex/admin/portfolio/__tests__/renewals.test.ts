import { anyApi } from "convex/server";
import { describe, expect, it } from "vitest";
import { FAIRLEND_ADMIN } from "../../../../src/test/auth/identities";
import {
	createHarness,
	createPortfolioFixture,
	FIXTURE_TIME,
} from "../../../../src/test/convex/portfolio-fixtures";
import { registerAuditLogComponent } from "../../../../src/test/convex/registerAuditLogComponent";
import { buildLenderRenewalTimeline } from "../../../renewals/constants";

const adminRenewalsApi = anyApi.admin.portfolio.renewals;

describe("admin lender portfolio renewals", () => {
	it("signals renewal intent for the target lender with admin transition metadata", async () => {
		const t = createHarness();
		registerAuditLogComponent(t, "auditLog");
		const { lenderId, mortgageId } = await createPortfolioFixture(t);
		const maturityDate = "2026-12-31";
		const timeline = buildLenderRenewalTimeline(maturityDate);

		const intentId = await t.run(async (ctx) => {
			const mortgage = await ctx.db.get(mortgageId);
			if (!mortgage) {
				throw new Error("Expected mortgage fixture");
			}
			await ctx.db.patch(mortgageId, { maturityDate });
			const positionAccount = await ctx.db
				.query("ledger_accounts")
				.withIndex("by_mortgage_and_lender", (query) =>
					query
						.eq("mortgageId", String(mortgageId))
						.eq("lenderId", "user_lender_test")
				)
				.unique();
			if (!positionAccount) {
				throw new Error("Expected position account fixture");
			}
			return await ctx.db.insert("lenderRenewalIntents", {
				brokerId: mortgage.brokerOfRecordId,
				createdAt: FIXTURE_TIME,
				fractionCount: 10_000,
				lenderId,
				machineContext: {},
				maturityDate: timeline.maturityAt,
				mortgageId,
				positionAccountId: String(positionAccount._id),
				signalDeadline: timeline.signalDeadlineAt,
				status: "pending_signal",
			});
		});

		const admin = t.withIdentity(FAIRLEND_ADMIN);
		await admin.mutation(adminRenewalsApi.signalAdminLenderRenewalIntent, {
			intent: "exit",
			mortgageId,
			reason: "Admin test signal",
			targetLenderId: lenderId,
		});

		const result = await t.run(async (ctx) => {
			const intent = await ctx.db.get(intentId);
			const events = await ctx.db
				.query("auditJournal")
				.withIndex("by_entity", (query) =>
					query
						.eq("entityType", "lenderRenewalIntent")
						.eq("entityId", String(intentId))
				)
				.collect();
			return { events, intent };
		});

		expect(result.intent).toMatchObject({
			intent: "exit",
			lenderId,
			status: "exiting",
		});
		expect(result.events.at(-1)).toMatchObject({
			actorId: FAIRLEND_ADMIN.subject,
			actorType: "admin",
			channel: "admin_dashboard",
		});
	});
});
