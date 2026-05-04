import { anyApi } from "convex/server";
import { describe, expect, it } from "vitest";
import {
	FAIRLEND_ADMIN,
	LENDER,
	MEMBER,
} from "../../../../src/test/auth/identities";
import {
	createHarness,
	createPortfolioFixture,
} from "../../../../src/test/convex/portfolio-fixtures";

const adminPortfolioApi = anyApi.admin.portfolio.queries;
const lenderPortfolioApi = anyApi.portfolio.queries;

describe("admin lender portfolio queries", () => {
	it("returns the same command-center contract as the lender portal query", async () => {
		const t = createHarness();
		const { lenderId, portalId } = await createPortfolioFixture(t);
		const lender = t.withIdentity(LENDER);
		const admin = t.withIdentity(FAIRLEND_ADMIN);

		const lenderResult = await lender.query(
			lenderPortfolioApi.getLenderPortfolioCommandCenter,
			{ portalId }
		);
		const adminResult = await admin.query(
			adminPortfolioApi.getAdminLenderPortfolioCommandCenter,
			{ targetLenderId: lenderId }
		);

		expect(adminResult.positions.rows).toEqual(lenderResult.positions.rows);
		expect(adminResult.paymentActivity.rows).toEqual(
			lenderResult.paymentActivity.rows
		);
		expect(adminResult.cockpit.metrics.activePositionCount).toBe(
			lenderResult.cockpit.metrics.activePositionCount
		);
	});

	it("returns lender-owned position details from explicit target lender ids", async () => {
		const t = createHarness();
		const { lenderId, mortgageId, portalId } = await createPortfolioFixture(t);
		const lender = t.withIdentity(LENDER);
		const admin = t.withIdentity(FAIRLEND_ADMIN);

		const lenderResult = await lender.query(
			lenderPortfolioApi.getLenderPortfolioPositionDetail,
			{ mortgageId, portalId }
		);
		const adminResult = await admin.query(
			adminPortfolioApi.getAdminLenderPortfolioPositionDetail,
			{ mortgageId, targetLenderId: lenderId }
		);

		expect(adminResult.position).toEqual(lenderResult.position);
		expect(adminResult.mortgage).toEqual(lenderResult.mortgage);
	});

	it("returns empty-state-safe command center data for zero-position targets", async () => {
		const t = createHarness();
		const { lenderId } = await createPortfolioFixture(t, { issueAmount: 0 });
		const admin = t.withIdentity(FAIRLEND_ADMIN);

		const result = await admin.query(
			adminPortfolioApi.getAdminLenderPortfolioCommandCenter,
			{ targetLenderId: lenderId }
		);

		expect(result.cockpit.metrics.activePositionCount).toBe(0);
		expect(result.positions.rows).toEqual([]);
		expect(result.paymentActivity.rows).toEqual([]);
		expect(result.actionsRequired).toEqual({ allClear: true, items: [] });
	});

	it("rejects non-admin callers even when they have lender portfolio permissions", async () => {
		const t = createHarness();
		const { lenderId } = await createPortfolioFixture(t);
		const lender = t.withIdentity(LENDER);
		const member = t.withIdentity(MEMBER);

		await expect(
			lender.query(adminPortfolioApi.getAdminLenderPortfolioCommandCenter, {
				targetLenderId: lenderId,
			})
		).rejects.toThrow();
		await expect(
			member.query(adminPortfolioApi.getAdminLenderPortfolioCommandCenter, {
				targetLenderId: lenderId,
			})
		).rejects.toThrow();
	});
});
