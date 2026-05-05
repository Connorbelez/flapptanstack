import type { FunctionReturnType } from "convex/server";
import { ParticipantDealsQueuePage } from "#/components/deals/participant/ParticipantDealsQueuePage";
import { ParticipantDealWorkspacePage } from "#/components/deals/participant/ParticipantDealWorkspacePage";
import { Card, CardContent } from "#/components/ui/card";
import type { api } from "../../convex/_generated/api";

type ParticipantDealQueue = FunctionReturnType<
	typeof api.deals.queries.getParticipantDealQueue
>;
type ParticipantDealWorkspace = NonNullable<
	FunctionReturnType<typeof api.deals.queries.getParticipantDealWorkspace>
>;

const baseQueueItem = {
	closingDate: 1_800_000_000_000,
	dealId: "deal_123" as never,
	group: "needsAction",
	nextAction: "Sign your purchasing lender closing documents",
	persona: "purchasing_lender",
	propertyLabel: "123 King St W, Toronto, ON",
	signingStatus: "ready_to_sign",
	status: "documentReview.signed",
} satisfies ParticipantDealQueue["needsAction"][number];

const purchasingLenderQueue: ParticipantDealQueue = {
	completed: [],
	inProgress: [],
	needsAction: [baseQueueItem],
	persona: "participating_lender",
};

const sellingLenderQueue: ParticipantDealQueue = {
	completed: [],
	inProgress: [
		{
			...baseQueueItem,
			group: "inProgress",
			nextAction: "Review closing progress",
			persona: "selling_lender",
			signingStatus: "upcoming",
		},
	],
	needsAction: [],
	persona: "selling_lender",
};

const emptyQueue: ParticipantDealQueue = {
	completed: [],
	inProgress: [],
	needsAction: [],
	persona: "participating_lender",
};

const baseWorkspace: ParticipantDealWorkspace = {
	blockers: [],
	closeReceipt: {
		closedAt: null,
		funds: null,
		signedArchiveStatus: null,
	},
	deal: {
		closingDate: 1_800_000_000_000,
		dealId: "deal_123" as never,
		fractionalShare: 2500,
		fractionalShareDisplayPercent: 25,
		fractionalShareUnits: 2500,
		lockingFeeAmount: null,
		persona: "purchasing_lender",
		status: "documentReview.signed",
	},
	documentInstances: [
		{
			archivedAt: null,
			archivedSigning: null,
			class: "private_templated_signable",
			displayName: "Closing Signature Package",
			instanceId: "instance_123" as never,
			kind: "generated",
			lastError: null,
			packageLabel: "Closing",
			signing: null,
			signingState: null,
			status: "signature_sent",
			url: null,
		},
	],
	documentPackage: {
		archivedAt: null,
		lastError: null,
		readyAt: 1_800_000_000_000,
		retryCount: 0,
		status: "ready",
	},
	legalRepresentation: {
		actions: {
			changeGuestEmail: {
				allowed: false,
				reason: "Representation is already confirmed for this deal.",
			},
			replaceLawyer: {
				allowed: false,
				reason: "Representation is already confirmed for this deal.",
			},
			resendInvitation: {
				allowed: false,
				reason: "Only pending, unexpired guest invitations can be resent.",
			},
		},
		activeLawyerAccessCount: 1,
		currentInvitation: {
			acceptedAt: null,
			deliveredAt: null,
			deliveryError: null,
			deliveryProvider: null,
			deliveryStatus: null,
			expiresAt: null,
			invitationId: null,
			lastDeliveryAttemptAt: null,
			status: "none",
			targetEmail: null,
			updatedAt: null,
			workosInvitationId: null,
		},
		gate: {
			message: "Legal representation gate is satisfied.",
			reasonCodes: [],
		},
		kind: "confirmed",
		label: "Representation confirmed",
		selectedLawyer: {
			email: "lawyer@test.fairlend.ca",
			lawyerId: "lawyer-auth",
			name: "Laura Lawyer",
			type: "guest_lawyer",
		},
		showInDealViews: false,
		summary: "Laura Lawyer has confirmed representation for this deal.",
	},
	mortgage: {
		interestRate: 9.5,
		maturityDate: "2031-01-01",
		mortgageId: "mortgage_123" as never,
		paymentAmount: 2500,
		paymentFrequency: "monthly",
		principal: 500_000,
		status: "funded",
	},
	nextAction: "Sign your purchasing lender closing documents",
	participants: {
		buyer: {
			accessRole: "lender",
			authId: "buyer-auth",
			displayName: "Bianca Purchasing",
			email: "buyer@test.fairlend.ca",
			lenderId: "lender_123" as never,
			userId: "user_123" as never,
		},
		dealId: "deal_123" as never,
		fractionalShareDisplayPercent: 25,
		fractionalShareStatus: {
			fractionalShareDisplayPercent: 25,
			fractionalShareUnits: 2500,
			isValid: true,
			validationError: null,
		},
		fractionalShareUnits: 2500,
		involvedParties: [
			{
				email: "buyer@test.fairlend.ca",
				hasWorkspaceAccess: true,
				label: "Purchasing lender",
				name: "Bianca Purchasing",
				role: "purchasing_lender",
			},
			{
				email: "seller@test.fairlend.ca",
				hasWorkspaceAccess: true,
				label: "Selling lender",
				name: "Sam Selling",
				role: "selling_lender",
			},
			{
				email: "lawyer@test.fairlend.ca",
				hasWorkspaceAccess: true,
				label: "Primary lawyer",
				name: "Laura Lawyer",
				role: "primary_lawyer",
			},
		],
		lawyer: {
			authId: "lawyer-auth",
			displayName: "Laura Lawyer",
			email: "lawyer@test.fairlend.ca",
			hasActiveDealAccess: true,
			lawyerType: "guest_lawyer",
		},
		personas: {
			assigned_broker: "assigned_broker",
			broker_of_record: "broker_of_record",
			fairlend_admin: "fairlend_admin",
			primary_borrower: "primary_borrower",
			primary_lawyer: "primary_lawyer",
			purchasing_lender: "purchasing_lender",
			selling_lender: "selling_lender",
		},
		primary_borrower: {
			authId: "seller-auth",
			borrowerId: "borrower_123" as never,
			displayName: "Sam Borrower",
			email: "borrower@test.fairlend.ca",
			persona: "primary_borrower",
			userId: "user_789" as never,
		},
		primary_lawyer: {
			authId: "lawyer-auth",
			displayName: "Laura Lawyer",
			email: "lawyer@test.fairlend.ca",
			hasActiveDealAccess: true,
			lawyerType: "guest_lawyer",
			persona: "primary_lawyer",
		},
		purchasing_lender: {
			accessRole: "lender",
			authId: "buyer-auth",
			displayName: "Bianca Purchasing",
			email: "buyer@test.fairlend.ca",
			lenderId: "lender_123" as never,
			persona: "purchasing_lender",
			userId: "user_123" as never,
		},
		seller: {
			accessRole: "lender",
			authId: "seller-auth",
			borrowerId: null,
			displayName: "Sam Selling",
			email: "seller@test.fairlend.ca",
			lenderId: "lender_456" as never,
			userId: "user_456" as never,
		},
		selling_lender: {
			accessRole: "lender",
			authId: "seller-auth",
			displayName: "Sam Selling",
			email: "seller@test.fairlend.ca",
			lenderId: "lender_456" as never,
			persona: "selling_lender",
			userId: "user_456" as never,
		},
	},
	parties: {
		assignedLawyer: {
			email: "lawyer@test.fairlend.ca",
			name: "Laura Lawyer",
		},
		lender: {
			email: "buyer@test.fairlend.ca",
			name: "Bianca Purchasing",
		},
		seller: {
			email: "seller@test.fairlend.ca",
			name: "Sam Selling",
		},
	},
	persona: "purchasing_lender",
	property: {
		city: "Toronto",
		propertyType: "residential",
		province: "ON",
		streetAddress: "123 King St W",
		unit: null,
	},
	queueGroup: "needsAction",
	signing: {
		attemptId: "attempt_123" as never,
		completedRequiredCount: 0,
		embeddedSigningToken: "purchasing-lender-token",
		exceptionMessage: null,
		providerDocumentId: "doc_123",
		providerEnvelopeId: "env_123",
		recipientName: "Bianca Purchasing",
		recipients: [
			{
				completedAt: null,
				documensoRole: "SIGNER",
				name: "Bianca Purchasing",
				platformRole: "purchasing_lender",
				required: true,
				signingOrder: 1,
				signingStatus: "not_started",
			},
		],
		requiredCount: 2,
		status: "ready_to_sign",
		tokenExpiresAt: 1_800_000_060_000,
	},
	timeline: [
		{
			at: 1_800_000_000_000,
			description: "The closing workspace was created.",
			label: "Deal opened",
			status: "complete",
		},
		{
			at: 1_800_000_000_000,
			description: "Closing documents are prepared for review and signing.",
			label: "Package ready",
			status: "complete",
		},
	],
};

export function E2eParticipantWorkspacesFixture() {
	const scenario = new URLSearchParams(window.location.search).get("scenario");
	if (scenario === "selling-lender-queue") {
		return <ParticipantDealsQueuePage queue={sellingLenderQueue} />;
	}
	if (scenario === "empty") {
		return <ParticipantDealsQueuePage queue={emptyQueue} />;
	}
	if (scenario === "completed") {
		return (
			<ParticipantDealWorkspacePage
				backTo="/lender/deals"
				workspace={{
					...baseWorkspace,
					closeReceipt: {
						closedAt: 1_800_000_086_000,
						funds: {
							providerCode: undefined,
							receivedAt: 1_800_000_084_000,
							recordedAt: 1_800_000_085_000,
							sourceKind: "manual_admin",
						},
						signedArchiveStatus: "archived",
					},
					deal: {
						...baseWorkspace.deal,
						status: "confirmed",
					},
					nextAction: "Review your closing receipt",
					queueGroup: "completed",
				}}
			/>
		);
	}
	if (scenario === "unauthorized") {
		return (
			<div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
				<Card>
					<CardContent className="space-y-2 p-6">
						<h1 className="font-semibold text-2xl">Workspace unavailable</h1>
						<p className="text-muted-foreground text-sm">
							Forbidden: no participating_lender workspace access for this deal.
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}
	if (scenario === "workspace") {
		return (
			<ParticipantDealWorkspacePage
				backTo="/lender/deals"
				workspace={baseWorkspace}
			/>
		);
	}
	return <ParticipantDealsQueuePage queue={purchasingLenderQueue} />;
}
