import { setup } from "xstate";

export const micInvestorAccessRequestMachine = setup({
	types: {
		context: {} as Record<string, never>,
		events: {} as { type: "APPROVE" } | { type: "REJECT" },
	},
	actions: {
		provisionMicInvestorAccess: () => {
			/* resolved by GT effect registry */
		},
	},
}).createMachine({
	id: "micInvestorAccessRequest",
	initial: "pending_review",
	context: {},
	states: {
		pending_review: {
			on: {
				APPROVE: {
					actions: ["provisionMicInvestorAccess"],
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
