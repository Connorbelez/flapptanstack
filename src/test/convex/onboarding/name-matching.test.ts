import { describe, expect, it } from "vitest";
import {
	compareNormalizedBrokerOnboardingNames,
	computeBrokerOnboardingNameSimilarityScores,
	jaroWinklerSimilarity,
} from "../../../../convex/onboarding/verification/nameMatching";

describe("broker onboarding name matching", () => {
	it("treats accent and suffix-only differences as near-exact matches", () => {
		const scores = computeBrokerOnboardingNameSimilarityScores({
			selfReportedName: { fullName: "François A. Smith Jr." },
			regulatorName: { fullName: "Francois Smith" },
			identityName: { fullName: "Francois A Smith" },
		});

		expect(scores.selfReportedVsRegulator).toBeGreaterThanOrEqual(0.92);
		expect(scores.selfReportedVsIdentity).toBeGreaterThanOrEqual(0.92);
		expect(scores.regulatorVsIdentity).toBeGreaterThanOrEqual(0.92);
		expect(scores.effectiveScore).toBeGreaterThanOrEqual(0.92);
	});

	it("uses the lower of first-name and last-name similarity for pair scores", () => {
		const pairScore = compareNormalizedBrokerOnboardingNames(
			{ fullName: "Francois Smith" },
			{ fullName: "Francois Smyth" }
		);
		const lastNameOnlyScore = jaroWinklerSimilarity("smith", "smyth");

		expect(pairScore).toBe(lastNameOnlyScore);
		expect(pairScore).toBeLessThan(1);
	});

	it("returns a null effective score until all three pairwise comparisons exist", () => {
		const scores = computeBrokerOnboardingNameSimilarityScores({
			selfReportedName: { fullName: "Francois Smith" },
			regulatorName: { fullName: "Francois Smith" },
			identityName: null,
		});

		expect(scores.selfReportedVsRegulator).toBe(1);
		expect(scores.selfReportedVsIdentity).toBeNull();
		expect(scores.regulatorVsIdentity).toBeNull();
		expect(scores.effectiveScore).toBeNull();
	});
});
