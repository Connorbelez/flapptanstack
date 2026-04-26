import { assign, setup } from "xstate";

export interface BrokerOnboardingApplicationMachineContext {
	activationCompletedAt: number | null;
	approvedAt: number | null;
	changesRequestedAt: number | null;
	currentStep: string | null;
	draftLastSavedAt: number | null;
	rejectedAt: number | null;
	submitCount: number;
	submittedAt: number | null;
}

export const INITIAL_BROKER_ONBOARDING_APPLICATION_MACHINE_CONTEXT: BrokerOnboardingApplicationMachineContext =
	{
		activationCompletedAt: null,
		approvedAt: null,
		changesRequestedAt: null,
		currentStep: "draft",
		draftLastSavedAt: null,
		rejectedAt: null,
		submittedAt: null,
		submitCount: 0,
	};

export const BROKER_ONBOARDING_APPLICATION_MACHINE_VERSION = "1.0.0";

export const brokerOnboardingApplicationMachine = setup({
	types: {
		context: {} as BrokerOnboardingApplicationMachineContext,
		events: {} as
			| { type: "SUBMIT"; submittedAt: number }
			| { type: "REQUEST_CHANGES"; requestedAt: number }
			| { type: "APPROVE"; approvedAt: number }
			| { type: "REJECT"; rejectedAt: number }
			| { type: "MARK_ACTIVATED"; activatedAt: number },
	},
	actions: {
		recordSubmission: assign({
			currentStep: () => "submitted",
			submittedAt: ({ event }) =>
				(event as { submittedAt: number }).submittedAt,
			submitCount: ({ context }) => context.submitCount + 1,
		}),
		recordChangesRequested: assign({
			changesRequestedAt: ({ event }) =>
				(event as { requestedAt: number }).requestedAt,
			currentStep: () => "changes_requested",
		}),
		recordApproval: assign({
			approvedAt: ({ event }) => (event as { approvedAt: number }).approvedAt,
			currentStep: () => "approved",
		}),
		recordRejection: assign({
			currentStep: () => "rejected",
			rejectedAt: ({ event }) => (event as { rejectedAt: number }).rejectedAt,
		}),
		recordActivation: assign({
			activationCompletedAt: ({ event }) =>
				(event as { activatedAt: number }).activatedAt,
			currentStep: () => "activated",
		}),
	},
}).createMachine({
	id: "brokerOnboardingApplication",
	version: BROKER_ONBOARDING_APPLICATION_MACHINE_VERSION,
	initial: "draft",
	context: INITIAL_BROKER_ONBOARDING_APPLICATION_MACHINE_CONTEXT,
	states: {
		draft: {
			on: {
				SUBMIT: {
					target: "submitted",
					actions: ["recordSubmission"],
				},
			},
		},
		submitted: {
			on: {
				REQUEST_CHANGES: {
					target: "changes_requested",
					actions: ["recordChangesRequested"],
				},
				APPROVE: {
					target: "approved",
					actions: ["recordApproval"],
				},
				REJECT: {
					target: "rejected",
					actions: ["recordRejection"],
				},
			},
		},
		changes_requested: {
			on: {
				SUBMIT: {
					target: "submitted",
					actions: ["recordSubmission"],
				},
				REJECT: {
					target: "rejected",
					actions: ["recordRejection"],
				},
			},
		},
		approved: {
			on: {
				MARK_ACTIVATED: {
					target: "activated",
					actions: ["recordActivation"],
				},
			},
		},
		rejected: { type: "final" },
		activated: { type: "final" },
	},
});
