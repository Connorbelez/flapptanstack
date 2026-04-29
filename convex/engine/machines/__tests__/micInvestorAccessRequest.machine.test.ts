import { describe, expect, it } from "vitest";
import { getNextSnapshot } from "xstate";
import {
	MIC_INVESTOR_ACCESS_REQUEST_MACHINE_VERSION,
	micInvestorAccessRequestMachine,
} from "../micInvestorAccessRequest.machine";

function snapshotAt(stateValue: string) {
	return micInvestorAccessRequestMachine.resolveState({
		value: stateValue,
		context: {} as Record<string, never>,
	});
}

describe("micInvestorAccessRequest machine", () => {
	it("has stable machine metadata", () => {
		expect(micInvestorAccessRequestMachine.id).toBe("micInvestorAccessRequest");
		expect(micInvestorAccessRequestMachine.version).toBe(
			MIC_INVESTOR_ACCESS_REQUEST_MACHINE_VERSION
		);
		expect(micInvestorAccessRequestMachine.config.initial).toBe(
			"pending_review"
		);
		expect(micInvestorAccessRequestMachine.config.states?.rejected?.type).toBe(
			"final"
		);
	});

	it("schedules provisioning when a request is approved", () => {
		const approveTransition =
			micInvestorAccessRequestMachine.config.states?.pending_review?.on
				?.APPROVE;
		expect(approveTransition).toMatchObject({
			target: "approved",
			actions: ["provisionMicAccess"],
		});
	});

	it("transitions pending_review to approved on APPROVE", () => {
		expect(
			getNextSnapshot(
				micInvestorAccessRequestMachine,
				snapshotAt("pending_review"),
				{ type: "APPROVE" }
			).value
		).toBe("approved");
	});

	it("transitions pending_review to rejected on REJECT", () => {
		expect(
			getNextSnapshot(
				micInvestorAccessRequestMachine,
				snapshotAt("pending_review"),
				{ type: "REJECT" }
			).value
		).toBe("rejected");
	});

	it("keeps approved requests stable for repeated review events", () => {
		expect(
			getNextSnapshot(micInvestorAccessRequestMachine, snapshotAt("approved"), {
				type: "APPROVE",
			}).value
		).toBe("approved");
		expect(
			getNextSnapshot(micInvestorAccessRequestMachine, snapshotAt("approved"), {
				type: "REJECT",
			}).value
		).toBe("approved");
	});

	it("keeps rejected requests terminal", () => {
		expect(
			getNextSnapshot(micInvestorAccessRequestMachine, snapshotAt("rejected"), {
				type: "APPROVE",
			}).value
		).toBe("rejected");
		expect(
			getNextSnapshot(micInvestorAccessRequestMachine, snapshotAt("rejected"), {
				type: "REJECT",
			}).value
		).toBe("rejected");
	});
});
