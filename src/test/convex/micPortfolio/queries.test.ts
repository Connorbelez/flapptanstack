import { describe, expect, test } from "vitest";
import { api } from "../../../../convex/_generated/api";
import {
	seedMicPortfolioScenario,
	type SeededMicPortfolioScenario,
} from "../mic/seedMicScenario";

describe("MIC portfolio queries", () => {
	test("derives dashboard totals and rows from MIC ledger positions only", async () => {
		const scenario = await seedMicPortfolioScenario();
		const snapshot = await queryDashboard(scenario);

		expect(snapshot.sourceOfTruth).toBe("mortgage_ledger_lender_participation");
		expect(snapshot.dataCompleteness).toBe("partial");
		expect(snapshot.warnings).toEqual([scenario.expected.cashLedgerWarning]);
		expect(snapshot.metrics).toMatchObject({
			activePositionCount: 2,
			arrearsExposure: scenario.expected.metrics.arrearsExposure,
			outstandingPrincipal: scenario.expected.metrics.outstandingPrincipal,
			weightedAverageLtv: scenario.expected.metrics.weightedAverageLtv,
			weightedAverageYield: scenario.expected.metrics.weightedAverageYield,
		});
		expect(snapshot.positions.map((row) => row.propertyLabel)).toEqual(
			scenario.expected.positionLabels
		);
		expect(snapshot.positions).not.toContainEqual(
			expect.objectContaining({
				propertyLabel: scenario.expected.excludedNonMicPositionLabel,
			})
		);
		expect(snapshot.positions.map((row) => row.outstandingPrincipal)).toEqual(
			scenario.expected.positionOutstandingPrincipal
		);
		expect(snapshot.positions.map((row) => row.arrearsSignal.status)).toEqual([
			"exception",
			"current",
		]);
	});

	test("supports filters, detail, payment history, and concentration projections", async () => {
		const scenario = await seedMicPortfolioScenario();
		const viewer = scenario.t.withIdentity(scenario.identities.investor);

		const filtered = await viewer.query(
			api.micPortfolio.queries.getMicPositions,
			{
				filters: { propertyType: "multi_unit" },
				portalId: scenario.ids.portalId,
			}
		);
		expect(filtered.rows).toHaveLength(1);
		expect(filtered.rows[0]?.propertyLabel).toBe(
			scenario.expected.positionLabels[0]
		);

		const detail = await viewer.query(
			api.micPortfolio.queries.getMicPositionDetail,
			{
				mortgageId: scenario.ids.firstMortgageId,
				portalId: scenario.ids.portalId,
			}
		);
		expect(detail.position.position.propertyLabel).toBe(
			scenario.expected.positionLabels[0]
		);
		expect(detail.position.payments.map((row) => row.rowStatus)).toEqual([
			"exception",
			"settled",
		]);

		const payments = await viewer.query(
			api.micPortfolio.queries.getMicPaymentsHistory,
			{
				mortgageId: scenario.ids.firstMortgageId,
				portalId: scenario.ids.portalId,
			}
		);
		expect(payments.rows.map((row) => row.micShareAmount)).toEqual(
			scenario.expected.firstMortgagePaymentShares
		);

		const concentration = await viewer.query(
			api.micPortfolio.queries.getMicConcentrationExposure,
			{ portalId: scenario.ids.portalId }
		);
		expect(concentration.concentration.byGeography).toEqual([
			{
				count: 2,
				key: "ON",
				label: "ON",
				outstandingPrincipal: scenario.expected.metrics.outstandingPrincipal,
				sharePercent: 100,
			},
		]);
		expect(concentration.concentration.byPropertyType).toEqual(
			scenario.expected.concentrationByPropertyType
		);
	});
});

async function queryDashboard(scenario: SeededMicPortfolioScenario) {
	return await scenario.t
		.withIdentity(scenario.identities.investor)
		.query(api.micPortfolio.queries.getMicDashboardSnapshot, {
			portalId: scenario.ids.portalId,
		});
}
