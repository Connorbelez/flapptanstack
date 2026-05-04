import { describe, expect, it } from "vitest";
import {
	buildVelocityMockScenario,
	patchVelocityMockDeal,
	VELOCITY_MOCK_SCENARIO_NAMES,
	type VelocityMockScenarioName,
} from "../../../../convex/velocity/mock";

describe("Velocity mock scenario harness", () => {
	it("implements every named backend scenario with deterministic output", () => {
		for (const scenarioName of VELOCITY_MOCK_SCENARIO_NAMES) {
			const first = buildVelocityMockScenario({ scenarioName, seed: 337 });
			const second = buildVelocityMockScenario({ scenarioName, seed: 337 });

			expect(second).toEqual(first);
			expect(first.scenarioId).toContain(scenarioName);
			expect(first.loanCode).toBe("MOCK-LC-00337");
			expect(first.webhookPayload.events?.[0]?.deal?.loanCode).toBe(
				first.loanCode
			);
		}
	});

	it.each([
		["early_status_package_created", 4, undefined, ["velocity_not_funded"]],
		[
			"progression_to_funded",
			6,
			undefined,
			["missing_bank_data", "missing_pad_pdf", "missing_fairlend_owned_field"],
		],
		["missing_link_application_id", 6, undefined, ["missing_link_application_id"]],
		["unsupported_payment_frequency", 6, 4, ["unsupported_payment_frequency"]],
		["successful_all_or_nothing_activation", 6, undefined, []],
	] satisfies Array<
		[VelocityMockScenarioName, number, number | undefined, string[]]
	>)(
		"applies scenario defaults for %s",
		(scenarioName, expectedStatus, expectedFrequency, expectedBlockers) => {
			const scenario = buildVelocityMockScenario({ scenarioName, seed: 1001 });

			expect(scenario.mockDeal.status).toBe(expectedStatus);
			expect(scenario.expectedReadinessBlockers).toEqual(expectedBlockers);
			if (scenarioName === "missing_link_application_id") {
				expect(scenario.mockDeal.linkApplicationId).toBeUndefined();
			} else {
				expect(scenario.mockDeal.linkApplicationId).toBe("MOCK-LINK-01001");
			}
			if (expectedFrequency !== undefined) {
				expect(scenario.mockDeal.mortgageRequest?.paymentFrequency).toBe(
					expectedFrequency
				);
			}
		}
	);

	it("encodes non-Velocity scenario instructions for downstream activation coverage", () => {
		const missingPad = buildVelocityMockScenario({
			scenarioName: "missing_pad",
			seed: 1001,
		});
		const incompleteBank = buildVelocityMockScenario({
			scenarioName: "incomplete_bank_data",
			seed: 1001,
		});
		const scheduleFailure = buildVelocityMockScenario({
			scenarioName: "rotessa_schedule_failure",
			seed: 1001,
		});
		const drift = buildVelocityMockScenario({
			scenarioName: "post_live_velocity_drift",
			seed: 1001,
		});

		expect(missingPad).toMatchObject({
			expectedReadinessBlockers: ["missing_pad_pdf"],
			fairlendEnrichmentPatch: { padEvidenceRequired: false },
		});
		expect(incompleteBank.expectedReadinessBlockers).toEqual([
			"missing_bank_data",
		]);
		expect(incompleteBank.fairlendEnrichmentPatch?.bankInput).not.toHaveProperty(
			"accountNumber"
		);
		expect(scheduleFailure.expectedActivationBehavior).toBe(
			"rotessa_schedule_failure"
		);
		expect(drift).toMatchObject({
			expectedActivationBehavior: "post_live_velocity_drift",
			nextVelocityPatch: { mortgageRequest: { rate: 12.25 } },
		});
		expect(drift.mockDeal.mockScenario).toMatchObject({
			expectedActivationBehavior: "post_live_velocity_drift",
			scenarioName: "post_live_velocity_drift",
		});
	});

	it("keeps bounded randomization inside the requested ranges", () => {
		const scenario = buildVelocityMockScenario({
			amortizationMonths: [240],
			borrowerCount: { max: 2, min: 2 },
			paymentFrequency: [5],
			principal: { max: 200_000, min: 200_000 },
			province: ["BC"],
			rate: { max: 7.25, min: 7.25 },
			seed: 42,
			termMonths: [24],
		});

		expect(scenario.mockDeal.borrowers).toHaveLength(2);
		expect(scenario.mockDeal.mortgageRequest).toMatchObject({
			amortizationMonths: 240,
			mortgages: [{ amount: 200_000 }],
			paymentFrequency: 5,
			rate: 7.25,
			termInMonths: 24,
		});
		expect(scenario.mockDeal.subjectProperty).toMatchObject({
			province: 2,
		});
	});

	it("patches status, nested Velocity fields, unsupported enums, and removals", () => {
		const scenario = buildVelocityMockScenario({
			scenarioName: "progression_to_funded",
			seed: 77,
		});
		const patched = patchVelocityMockDeal(scenario.mockDeal, {
			mortgageRequest: { payment: 1300 },
			removeFieldPaths: ["subjectProperty.postalCode"],
			status: 7,
			unsupportedEnum: true,
		});

		expect(patched.status).toBe(999);
		expect(patched.mortgageRequest).toMatchObject({
			payment: 1300,
			rateType: 999,
		});
		expect(patched.subjectProperty?.postalCode).toBeUndefined();
	});
});
