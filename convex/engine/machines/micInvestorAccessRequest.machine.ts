import { setup } from "xstate";

export const micInvestorAccessRequestMachine = setup({
	types: {
		context: {} as Record<string, never>,
		events: {} as { type: "APPROVE" } | { type: "REJECT" },
	},
}).createMachine({
	id: "micInvestorAccessRequest",
	initial: "pending_review",
	context: {},
	states: {
		pending_review: {
			on: {
				APPROVE: {
					target: "approved",
				},
				REJECT: {
					target: "rejected",
				},
			},
		},
		approved: { type: "final" },
		rejected: { type: "final" },
	},
});
