import { describe, expect, it } from "vitest";
import { getNextSnapshot } from "xstate";
import { brokerOnboardingApplicationMachine } from "../brokerOnboardingApplication.machine";

function snapshotAt(stateValue: string) {
	return brokerOnboardingApplicationMachine.resolveState({
		value: stateValue,
		context: {
			activationCompletedAt: null,
			approvedAt: null,
			changesRequestedAt: null,
			currentStep: stateValue,
			draftLastSavedAt: null,
			rejectedAt: null,
			submittedAt: null,
			submitCount: 0,
		},
	});
}

describe("brokerOnboardingApplication machine", () => {
	it("draft → submitted on SUBMIT", () => {
		const current = snapshotAt("draft");
		const next = getNextSnapshot(brokerOnboardingApplicationMachine, current, {
			type: "SUBMIT",
		});
		expect(next.value).toBe("submitted");
		expect(next.context.submitCount).toBe(1);
	});

	it("submitted → changes_requested on REQUEST_CHANGES", () => {
		const current = snapshotAt("submitted");
		const next = getNextSnapshot(brokerOnboardingApplicationMachine, current, {
			type: "REQUEST_CHANGES",
		});
		expect(next.value).toBe("changes_requested");
	});

	it("submitted → approved on APPROVE", () => {
		const current = snapshotAt("submitted");
		const next = getNextSnapshot(brokerOnboardingApplicationMachine, current, {
			type: "APPROVE",
		});
		expect(next.value).toBe("approved");
	});

	it("submitted → rejected on REJECT", () => {
		const current = snapshotAt("submitted");
		const next = getNextSnapshot(brokerOnboardingApplicationMachine, current, {
			type: "REJECT",
		});
		expect(next.value).toBe("rejected");
	});

	it("changes_requested → submitted on SUBMIT", () => {
		const current = snapshotAt("changes_requested");
		const next = getNextSnapshot(brokerOnboardingApplicationMachine, current, {
			type: "SUBMIT",
		});
		expect(next.value).toBe("submitted");
	});

	it("approved → activated on MARK_ACTIVATED", () => {
		const current = snapshotAt("approved");
		const next = getNextSnapshot(brokerOnboardingApplicationMachine, current, {
			type: "MARK_ACTIVATED",
		});
		expect(next.value).toBe("activated");
	});

	it("draft ignores APPROVE", () => {
		const current = snapshotAt("draft");
		const next = getNextSnapshot(brokerOnboardingApplicationMachine, current, {
			type: "APPROVE",
		});
		expect(next.value).toBe("draft");
	});

	it("approved ignores SUBMIT", () => {
		const current = snapshotAt("approved");
		const next = getNextSnapshot(brokerOnboardingApplicationMachine, current, {
			type: "SUBMIT",
		});
		expect(next.value).toBe("approved");
	});

	it("activated ignores MARK_ACTIVATED", () => {
		const current = snapshotAt("activated");
		const next = getNextSnapshot(brokerOnboardingApplicationMachine, current, {
			type: "MARK_ACTIVATED",
		});
		expect(next.value).toBe("activated");
	});

	it("starts in draft with the correct machine id", () => {
		expect(brokerOnboardingApplicationMachine.config.initial).toBe("draft");
		expect(brokerOnboardingApplicationMachine.id).toBe(
			"brokerOnboardingApplication"
		);
	});
});
