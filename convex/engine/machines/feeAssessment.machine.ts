import { setup } from "xstate";

export const FEE_ASSESSMENT_MACHINE_VERSION = "1.0.0";

type FeeAssessmentEvent =
	| { type: "ASSESS" }
	| { type: "INVOICE" }
	| { type: "PARTIALLY_SETTLE" }
	| { type: "SETTLE" }
	| { type: "REVERSE" };

export const feeAssessmentMachine = setup({
	types: {
		context: {} as Record<string, never>,
		events: {} as FeeAssessmentEvent,
	},
}).createMachine({
	id: "feeAssessment",
	version: FEE_ASSESSMENT_MACHINE_VERSION,
	initial: "draft",
	context: {},
	states: {
		draft: {
			on: {
				ASSESS: {
					target: "assessed",
				},
			},
		},
		assessed: {
			on: {
				INVOICE: {
					target: "invoiced",
				},
				PARTIALLY_SETTLE: {
					target: "partially_settled",
				},
				SETTLE: {
					target: "settled",
				},
				REVERSE: {
					target: "reversed",
				},
			},
		},
		invoiced: {
			on: {
				PARTIALLY_SETTLE: {
					target: "partially_settled",
				},
				SETTLE: {
					target: "settled",
				},
				REVERSE: {
					target: "reversed",
				},
			},
		},
		partially_settled: {
			on: {
				SETTLE: {
					target: "settled",
				},
				REVERSE: {
					target: "reversed",
				},
			},
		},
		settled: {
			on: {
				REVERSE: {
					target: "reversed",
				},
			},
		},
		reversed: { type: "final" },
	},
});
