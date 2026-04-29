import { setup } from "xstate";

export const MIC_INVESTOR_ACCESS_REQUEST_MACHINE_VERSION = "1.0.0";

type MicInvestorAccessRequestEvent = { type: "APPROVE" } | { type: "REJECT" };

export const micInvestorAccessRequestMachine = setup({
	types: {
		context: {} as Record<string, never>,
		events: {} as MicInvestorAccessRequestEvent,
	},
	actions: {
		provisionMicAccess: () => {
			/* resolved by GT effect registry */
		},
	},
}).createMachine({
	id: "micInvestorAccessRequest",
	version: MIC_INVESTOR_ACCESS_REQUEST_MACHINE_VERSION,
	initial: "pending_review",
	context: {},
	states: {
		pending_review: {
			on: {
				APPROVE: {
					target: "approved",
					actions: ["provisionMicAccess"],
				},
				REJECT: {
					target: "rejected",
				},
			},
		},
		approved: {},
		rejected: { type: "final" },
	},
});
