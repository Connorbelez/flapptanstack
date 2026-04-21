import { describe, expect, it } from "vitest";
import { getNextSnapshot } from "xstate";
import {
	LENDER_RENEWAL_INTENT_MACHINE_VERSION,
	lenderRenewalIntentMachine,
} from "../lenderRenewalIntent.machine";

function snapshotAt(stateValue: string) {
	return lenderRenewalIntentMachine.resolveState({
		value: stateValue,
		context: {},
	});
}

const SIGNAL_RENEW = { type: "LENDER_SIGNALS_RENEW" as const };
const SIGNAL_EXIT = { type: "LENDER_SIGNALS_EXIT" as const };
const SIGNAL_PARTIAL_EXIT = {
	type: "LENDER_SIGNALS_PARTIAL_EXIT" as const,
};
const CHANGE_TO_RENEW = {
	type: "LENDER_CHANGES_MIND" as const,
	nextIntent: "renew" as const,
};
const CHANGE_TO_EXIT = {
	type: "LENDER_CHANGES_MIND" as const,
	nextIntent: "exit" as const,
};
const CHANGE_TO_PARTIAL_EXIT = {
	type: "LENDER_CHANGES_MIND" as const,
	nextIntent: "partial_exit" as const,
};
const DEADLINE_PASSED = { type: "DEADLINE_PASSED" as const };

describe("lender renewal intent machine", () => {
	it("has stable machine metadata", () => {
		expect(lenderRenewalIntentMachine.id).toBe("lenderRenewalIntent");
		expect(lenderRenewalIntentMachine.version).toBe("1.0.0");
		expect(LENDER_RENEWAL_INTENT_MACHINE_VERSION).toBe("1.0.0");
		expect(lenderRenewalIntentMachine.config.initial).toBe("pending_signal");
		expect(lenderRenewalIntentMachine.config.states?.expired?.type).toBe(
			"final"
		);
	});

	it("moves pending_signal into the correct terminal intent state", () => {
		expect(
			getNextSnapshot(
				lenderRenewalIntentMachine,
				snapshotAt("pending_signal"),
				SIGNAL_RENEW
			).value
		).toBe("renewed");
		expect(
			getNextSnapshot(
				lenderRenewalIntentMachine,
				snapshotAt("pending_signal"),
				SIGNAL_EXIT
			).value
		).toBe("exiting");
		expect(
			getNextSnapshot(
				lenderRenewalIntentMachine,
				snapshotAt("pending_signal"),
				SIGNAL_PARTIAL_EXIT
			).value
		).toBe("exiting");
		expect(
			getNextSnapshot(
				lenderRenewalIntentMachine,
				snapshotAt("pending_signal"),
				DEADLINE_PASSED
			).value
		).toBe("expired");
	});

	it("allows renewed intents to change mind only toward exit paths", () => {
		expect(
			getNextSnapshot(
				lenderRenewalIntentMachine,
				snapshotAt("renewed"),
				CHANGE_TO_EXIT
			).value
		).toBe("exiting");
		expect(
			getNextSnapshot(
				lenderRenewalIntentMachine,
				snapshotAt("renewed"),
				CHANGE_TO_PARTIAL_EXIT
			).value
		).toBe("exiting");
		expect(
			getNextSnapshot(
				lenderRenewalIntentMachine,
				snapshotAt("renewed"),
				CHANGE_TO_RENEW
			).value
		).toBe("renewed");
	});

	it("allows exiting intents to change mind back to renew only", () => {
		expect(
			getNextSnapshot(
				lenderRenewalIntentMachine,
				snapshotAt("exiting"),
				CHANGE_TO_RENEW
			).value
		).toBe("renewed");
		expect(
			getNextSnapshot(
				lenderRenewalIntentMachine,
				snapshotAt("exiting"),
				CHANGE_TO_EXIT
			).value
		).toBe("exiting");
		expect(
			getNextSnapshot(
				lenderRenewalIntentMachine,
				snapshotAt("exiting"),
				CHANGE_TO_PARTIAL_EXIT
			).value
		).toBe("exiting");
	});

	it("keeps expired intents terminal", () => {
		expect(
			getNextSnapshot(
				lenderRenewalIntentMachine,
				snapshotAt("expired"),
				SIGNAL_RENEW
			).value
		).toBe("expired");
		expect(
			getNextSnapshot(
				lenderRenewalIntentMachine,
				snapshotAt("expired"),
				CHANGE_TO_RENEW
			).value
		).toBe("expired");
	});
});
