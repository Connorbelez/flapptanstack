import { setup } from "xstate";

export const LENDER_RENEWAL_INTENT_MACHINE_VERSION = "1.0.0";

type LenderRenewalIntentEvent =
	| { type: "LENDER_SIGNALS_RENEW" }
	| { type: "LENDER_SIGNALS_EXIT" }
	| { type: "LENDER_SIGNALS_PARTIAL_EXIT" }
	| {
			type: "LENDER_CHANGES_MIND";
			nextIntent: "renew" | "exit" | "partial_exit";
	  }
	| { type: "DEADLINE_PASSED" };

export const lenderRenewalIntentMachine = setup({
	types: {
		context: {} as Record<string, never>,
		events: {} as LenderRenewalIntentEvent,
	},
	guards: {
		changeIntentToRenew: ({ event }) =>
			event.type === "LENDER_CHANGES_MIND" && event.nextIntent === "renew",
		changeIntentToExit: ({ event }) =>
			event.type === "LENDER_CHANGES_MIND" &&
			(event.nextIntent === "exit" || event.nextIntent === "partial_exit"),
	},
}).createMachine({
	id: "lenderRenewalIntent",
	version: LENDER_RENEWAL_INTENT_MACHINE_VERSION,
	initial: "pending_signal",
	context: {},
	states: {
		pending_signal: {
			on: {
				LENDER_SIGNALS_RENEW: {
					target: "renewed",
				},
				LENDER_SIGNALS_EXIT: {
					target: "exiting",
				},
				LENDER_SIGNALS_PARTIAL_EXIT: {
					target: "exiting",
				},
				DEADLINE_PASSED: {
					target: "expired",
				},
			},
		},
		renewed: {
			on: {
				LENDER_CHANGES_MIND: {
					guard: "changeIntentToExit",
					target: "exiting",
				},
			},
		},
		exiting: {
			on: {
				LENDER_CHANGES_MIND: {
					guard: "changeIntentToRenew",
					target: "renewed",
				},
			},
		},
		expired: { type: "final" },
	},
});
