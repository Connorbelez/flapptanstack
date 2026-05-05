import type { ComponentProps } from "react";
import type { ParticipantDealsQueuePage } from "#/components/deals/participant/ParticipantDealsQueuePage";
import type { ParticipantDealWorkspacePage } from "#/components/deals/participant/ParticipantDealWorkspacePage";
import type { LawyerAssignedClosingsPage } from "#/components/lawyer/deals/LawyerAssignedClosingsPage";
import type { LawyerDealWorkspaceContent } from "#/components/lawyer/deals/LawyerDealWorkspacePage";
import type { PortalDealDetailContent } from "#/components/portal/deals/PortalDealDetailPage";

type ParticipantQueue = ComponentProps<
	typeof ParticipantDealsQueuePage
>["queue"];
type ParticipantWorkspace = ComponentProps<
	typeof ParticipantDealWorkspacePage
>["workspace"];
type LawyerMatters = ComponentProps<
	typeof LawyerAssignedClosingsPage
>["matters"];
export type LawyerMatterStoryItem = LawyerMatters[number];
type LawyerWorkspace = ComponentProps<
	typeof LawyerDealWorkspaceContent
>["workspace"];
type PortalDealDetail = NonNullable<
	ComponentProps<typeof PortalDealDetailContent>["detail"]
>;

const STORY_CLOSING_AT = Date.parse("2026-05-15T16:00:00.000Z");
const STORY_READY_AT = Date.parse("2026-05-10T14:30:00.000Z");
const STORY_SIGNED_AT = Date.parse("2026-05-17T18:00:00.000Z");

const purchasingLenderParticipant = {
	accessRole: "lender",
	authId: "buyer-auth",
	displayName: "Bianca Purchasing",
	email: "bianca@example.test",
	lenderId: "lender_bianca" as never,
	userId: "user_bianca" as never,
};

const sellingLenderParticipant = {
	accessRole: "lender",
	authId: "seller-auth",
	borrowerId: null,
	displayName: "Sam Selling",
	email: "sam@example.test",
	lenderId: "lender_sam" as never,
	userId: "user_sam" as never,
};

const primaryBorrowerParticipant = {
	authId: "borrower-auth",
	borrowerId: "borrower_bailey" as never,
	displayName: "Bailey Borrower",
	email: "bailey@example.test",
	persona: "primary_borrower",
	userId: "user_bailey" as never,
};

const lawyerParticipant = {
	authId: "lawyer-auth",
	displayName: "Laura Lawyer",
	email: "laura@example.test",
	hasActiveDealAccess: true,
	lawyerType: "guest_lawyer",
};

const participants = {
	buyer: purchasingLenderParticipant,
	dealId: "deal_king" as never,
	fractionalShareDisplayPercent: 25,
	fractionalShareStatus: {
		fractionalShareDisplayPercent: 25,
		fractionalShareUnits: 2500,
		isValid: true,
		validationError: null,
	},
	fractionalShareUnits: 2500,
	lawyer: lawyerParticipant,
	personas: {
		assigned_broker: "assigned_broker",
		broker_of_record: "broker_of_record",
		fairlend_admin: "fairlend_admin",
		primary_borrower: "primary_borrower",
		primary_lawyer: "primary_lawyer",
		purchasing_lender: "purchasing_lender",
		selling_lender: "selling_lender",
	},
	primary_borrower: primaryBorrowerParticipant,
	primary_lawyer: {
		...lawyerParticipant,
		persona: "primary_lawyer",
	},
	purchasing_lender: {
		...purchasingLenderParticipant,
		persona: "purchasing_lender",
	},
	seller: sellingLenderParticipant,
	selling_lender: {
		...sellingLenderParticipant,
		persona: "selling_lender",
	},
};

export const participantPurchasingLenderQueueFixture = {
	completed: [
		{
			closingDate: Date.parse("2026-04-01T16:00:00.000Z"),
			dealId: "deal_closed" as never,
			group: "completed",
			nextAction: "Closing completed and archived.",
			persona: "purchasing_lender",
			propertyLabel: "88 Queen St W, Toronto, ON",
			signingStatus: "completed",
			status: "confirmed",
		},
	],
	inProgress: [
		{
			closingDate: STORY_CLOSING_AT,
			dealId: "deal_review" as never,
			group: "inProgress",
			nextAction: "Lawyer is reviewing the generated package.",
			persona: "purchasing_lender",
			propertyLabel: "55 Front St E, Toronto, ON",
			signingStatus: "signature_draft",
			status: "documentReview.pending",
		},
	],
	needsAction: [
		{
			closingDate: STORY_CLOSING_AT,
			dealId: "deal_king" as never,
			group: "needsAction",
			nextAction: "Sign your purchasing lender closing documents.",
			persona: "purchasing_lender",
			propertyLabel: "123 King St W, Toronto, ON",
			signingStatus: "ready_to_sign",
			status: "documentReview.signed",
		},
	],
	persona: "purchasing_lender",
} as unknown as ParticipantQueue;

export const participantSellingLenderQueueFixture = {
	...participantPurchasingLenderQueueFixture,
	persona: "selling_lender",
	needsAction: participantPurchasingLenderQueueFixture.needsAction.map(
		(item) => ({
			...item,
			nextAction: "Review selling lender close receipt and archived documents.",
			persona: "selling_lender",
		})
	),
} as unknown as ParticipantQueue;

export const emptyParticipantQueueFixture = {
	completed: [],
	inProgress: [],
	needsAction: [],
	persona: "purchasing_lender",
} as unknown as ParticipantQueue;

export const participantWorkspaceFixture = {
	blockers: [],
	closeReceipt: {
		closedAt: null,
		funds: null,
		signedArchiveStatus: null,
	},
	deal: {
		closingDate: STORY_CLOSING_AT,
		dealId: "deal_king" as never,
		fractionalShare: 2500,
		fractionalShareDisplayPercent: 25,
		fractionalShareUnits: 2500,
		lockingFeeAmount: null,
		persona: "purchasing_lender",
		status: "documentReview.signed",
	},
	documentInstances: [
		{
			class: "private_static",
			displayName: "Borrower Disclosure Package",
			instanceId: "instance_static" as never,
			kind: "uploaded",
			packageLabel: "Closing",
			signingState: null,
			status: "available",
			url: "https://example.test/disclosure.pdf",
		},
		{
			class: "private_templated_signable",
			displayName: "Closing Signature Package",
			instanceId: "instance_signable" as never,
			kind: "generated",
			packageLabel: "Closing",
			signingState: null,
			status: "signature_sent",
			url: null,
		},
	],
	documentPackage: {
		readyAt: STORY_READY_AT,
		status: "ready",
	},
	mortgage: {
		interestRate: 9.5,
		maturityDate: "2031-01-01",
		mortgageId: "mortgage_king" as never,
		paymentAmount: 2500,
		paymentFrequency: "monthly",
		principal: 500_000,
		status: "funded",
	},
	nextAction: "Sign your purchasing lender closing documents.",
	participants,
	parties: {
		assignedLawyer: {
			email: lawyerParticipant.email,
			name: lawyerParticipant.displayName,
		},
		lender: {
			email: purchasingLenderParticipant.email,
			name: purchasingLenderParticipant.displayName,
		},
		seller: {
			email: sellingLenderParticipant.email,
			name: sellingLenderParticipant.displayName,
		},
	},
	persona: "purchasing_lender",
	property: {
		city: "Toronto",
		propertyType: "residential",
		province: "ON",
		streetAddress: "123 King St W",
		unit: "1204",
	},
	queueGroup: "needsAction",
	signing: {
		attemptId: "attempt_king" as never,
		completedRequiredCount: 1,
		embeddedSigningToken: "https://sign.example.test/session/purchasing-lender",
		exceptionMessage: null,
		providerDocumentId: "doc_king",
		providerEnvelopeId: "env_king",
		recipientName: "Bianca Purchasing",
		recipients: [
			{
				completedAt: STORY_READY_AT,
				documensoRole: "SIGNER",
				name: "Sam Selling",
				platformRole: "selling_lender",
				required: true,
				signingOrder: 1,
				signingStatus: "completed",
			},
			{
				completedAt: null,
				documensoRole: "SIGNER",
				name: "Bianca Purchasing",
				platformRole: "purchasing_lender",
				required: true,
				signingOrder: 2,
				signingStatus: "not_started",
			},
		],
		requiredCount: 2,
		status: "ready_to_sign",
		tokenExpiresAt: Date.parse("2026-05-16T16:00:00.000Z"),
	},
	timeline: [
		{
			at: STORY_READY_AT,
			description: "The closing workspace was created.",
			label: "Deal opened",
			status: "complete",
		},
		{
			at: STORY_CLOSING_AT,
			description: "Purchasing lender signature is ready in the portal.",
			label: "Purchasing lender signing",
			status: "current",
		},
	],
} as unknown as ParticipantWorkspace;

export const blockedParticipantWorkspaceFixture = {
	...participantWorkspaceFixture,
	blockers: [
		{
			kind: "missing_signing_token",
			message: "The provider has not issued a signing token for this viewer.",
		},
	],
	nextAction: "Wait for signing access to be reissued.",
	signing: {
		...participantWorkspaceFixture.signing,
		embeddedSigningToken: null,
		status: "pending_recipient_resolution",
	},
} as unknown as ParticipantWorkspace;

export const completedParticipantWorkspaceFixture = {
	...participantWorkspaceFixture,
	closeReceipt: {
		closedAt: STORY_SIGNED_AT,
		funds: {
			amount: 125_000,
			sourceKind: "manual_wire",
		},
		signedArchiveStatus: "archived",
	},
	deal: {
		...participantWorkspaceFixture.deal,
		status: "confirmed",
	},
	nextAction: "Closing completed. Review the receipt and archive.",
	queueGroup: "completed",
	signing: {
		...participantWorkspaceFixture.signing,
		completedRequiredCount: 2,
		embeddedSigningToken: null,
		status: "completed",
	},
} as unknown as ParticipantWorkspace;

export const lawyerMattersFixture = [
	{
		accessRole: "guest_lawyer",
		accessState: "active",
		bucket: "needsRepresentationConfirmation",
		closingDate: STORY_CLOSING_AT,
		dealId: "deal_rep" as never,
		fractionalShareDisplayPercent: 25,
		lawyer: lawyerParticipant,
		matterName: "Bianca Purchasing / Sam Selling",
		participants: { ...participants, dealId: "deal_rep" as never },
		status: "lawyerOnboarding.verified",
	},
	{
		accessRole: "platform_lawyer",
		accessState: "active",
		bucket: "needsPackageReview",
		closingDate: STORY_CLOSING_AT,
		dealId: "deal_review" as never,
		fractionalShareDisplayPercent: 40,
		lawyer: lawyerParticipant,
		matterName: "Nadia North / Peter Park",
		participants,
		status: "documentReview.pending",
	},
	{
		accessRole: "guest_lawyer",
		accessState: "completed_read_only",
		bucket: "completed",
		closingDate: Date.parse("2026-04-01T16:00:00.000Z"),
		dealId: "deal_done" as never,
		fractionalShareDisplayPercent: 10,
		lawyer: lawyerParticipant,
		matterName: "Closed Purchasing Lender / Closed Selling Lender",
		participants,
		status: "confirmed",
	},
] as unknown as LawyerMatters;

export const lawyerWorkspaceFixture = {
	access: {
		accessRole: "guest_lawyer",
		accessState: "active",
	},
	deal: {
		closingDate: STORY_CLOSING_AT,
		dealId: "deal_review" as never,
		fractionalShareDisplayPercent: 25,
		status: "documentReview.pending",
	},
	envelope: {
		attempts: [
			{
				active: true,
				attemptNumber: 1,
				createdAt: STORY_READY_AT,
				dealDocumentInstanceId: "instance_signable" as never,
				dealId: "deal_review" as never,
				exceptions: [],
				idempotencyKey: "attempt-1",
				packageId: "package_review" as never,
				provider: "documenso",
				recipientRoster: [],
				recipients: [
					{
						attemptId: "attempt_1" as never,
						completedAt: STORY_READY_AT,
						createdAt: STORY_READY_AT,
						dealDocumentInstanceId: "instance_signable" as never,
						dealId: "deal_review" as never,
						documensoRole: "SIGNER",
						email: sellingLenderParticipant.email,
						name: sellingLenderParticipant.displayName,
						packageId: "package_review" as never,
						platformRole: "selling_lender",
						readStatus: "opened",
						required: true,
						sendStatus: "sent",
						signingOrder: 1,
						signingStatus: "completed",
						tokenAvailable: false,
						tokenAvailableAt: undefined,
						tokenExpiresAt: undefined,
						updatedAt: STORY_READY_AT,
					},
					{
						attemptId: "attempt_1" as never,
						createdAt: STORY_READY_AT,
						dealDocumentInstanceId: "instance_signable" as never,
						dealId: "deal_review" as never,
						documensoRole: "APPROVER",
						email: lawyerParticipant.email,
						name: lawyerParticipant.displayName,
						packageId: "package_review" as never,
						platformRole: "primary_lawyer",
						readStatus: "available",
						required: true,
						sendStatus: "sent",
						signingOrder: 2,
						signingStatus: "not_started",
						tokenAvailable: true,
						tokenAvailableAt: STORY_READY_AT,
						tokenExpiresAt: Date.parse("2026-06-01T16:00:00.000Z"),
						updatedAt: STORY_READY_AT,
					},
				],
				status: "partially_signed",
				updatedAt: STORY_READY_AT,
			},
		],
		exceptions: [],
	},
	matterOverview: {
		mortgage: participantWorkspaceFixture.mortgage,
		participants,
		property: participantWorkspaceFixture.property,
	},
	packageReview: {
		approval: {
			blockers: [],
			eligible: true,
		},
		instances: participantWorkspaceFixture.documentInstances,
		package: {
			readyAt: STORY_READY_AT,
			status: "ready",
		},
	},
	readOnly: false,
	timeline: {
		closeMilestones: [
			{
				at: STORY_CLOSING_AT,
				description: "Scheduled close date.",
				title: "Close scheduled",
			},
		],
		legalActions: [
			{
				at: STORY_READY_AT,
				description: "Representation confirmed by Laura Lawyer.",
				eventType: "REPRESENTATION_CONFIRMED",
				outcome: "transitioned",
				title: "REPRESENTATION_CONFIRMED",
			},
		],
	},
} as unknown as LawyerWorkspace;

export const blockedLawyerWorkspaceFixture = {
	...lawyerWorkspaceFixture,
	envelope: {
		...lawyerWorkspaceFixture.envelope,
		exceptions: [
			{
				createdAt: STORY_READY_AT,
				kind: "pre_send_configuration_failure",
				message: "Selling lender recipient mapping is missing a provider role.",
				raisedAt: STORY_READY_AT,
				severity: "blocking",
				status: "open",
			},
		],
	},
	packageReview: {
		...lawyerWorkspaceFixture.packageReview,
		approval: {
			blockers: ["Open pre-send configuration exceptions must be resolved."],
			eligible: false,
		},
	},
} as unknown as LawyerWorkspace;

export const readOnlyLawyerWorkspaceFixture = {
	...lawyerWorkspaceFixture,
	access: {
		accessRole: "guest_lawyer",
		accessState: "completed_read_only",
	},
	deal: {
		...lawyerWorkspaceFixture.deal,
		status: "confirmed",
	},
	readOnly: true,
} as unknown as LawyerWorkspace;

export const portalDealDetailFixture = {
	deal: {
		closingDate: STORY_CLOSING_AT,
		dealId: "deal_king" as never,
		fractionalShare: 2500,
		status: "documentReview.signed",
	},
	documentInstances: [
		{
			archivedAt: null,
			archivedSigning: null,
			class: "private_static",
			displayName: "Borrower Disclosure Package",
			instanceId: "portal_static" as never,
			kind: "uploaded",
			lastError: null,
			packageLabel: "Closing",
			signing: null,
			status: "available",
			url: "https://example.test/disclosure.pdf",
		},
		{
			archivedAt: null,
			archivedSigning: null,
			class: "private_templated_non_signable",
			displayName: "Funding Direction",
			instanceId: "portal_readonly" as never,
			kind: "generated",
			lastError: null,
			packageLabel: "Closing",
			signing: null,
			status: "available",
			url: "https://example.test/funding-direction.pdf",
		},
		{
			archivedAt: null,
			archivedSigning: null,
			class: "private_templated_signable",
			displayName: "Closing Signature Package",
			instanceId: "portal_signable" as never,
			kind: "generated",
			lastError: null,
			packageLabel: "Closing",
			signing: {
				canLaunchEmbeddedSigning: true,
				envelopeId: "env_king",
				generatedDocumentSigningStatus: "signature_sent",
				lastError: null,
				lastProviderSyncAt: STORY_READY_AT,
				recipients: [
					{
						isCurrentViewer: true,
						name: "Bianca Purchasing",
						platformRole: "purchasing_lender",
						status: "not_started",
					},
					{
						isCurrentViewer: false,
						name: "Sam Selling",
						platformRole: "selling_lender",
						status: "completed",
					},
				],
				status: "signature_sent",
			},
			status: "signature_sent",
			url: null,
		},
	],
	documentPackage: {
		archivedAt: null,
		lastError: null,
		readyAt: STORY_READY_AT,
		retryCount: 0,
		status: "ready",
	},
	mortgage: participantWorkspaceFixture.mortgage,
	parties: participantWorkspaceFixture.parties,
	property: participantWorkspaceFixture.property,
} as unknown as PortalDealDetail;

export const portalArchivedDealDetailFixture = {
	...portalDealDetailFixture,
	deal: {
		...portalDealDetailFixture.deal,
		status: "confirmed",
	},
	documentInstances: portalDealDetailFixture.documentInstances.map(
		(document) =>
			document.class === "private_templated_signable"
				? {
						...document,
						archivedAt: STORY_SIGNED_AT,
						archivedSigning: {
							completionCertificateUrl:
								"https://example.test/completion-certificate.pdf",
							finalPdfUrl: "https://example.test/final-closing-package.pdf",
							signingCompletedAt: STORY_SIGNED_AT,
						},
						signing: null,
						status: "available",
					}
				: document
	),
	documentPackage: {
		...portalDealDetailFixture.documentPackage,
		archivedAt: STORY_SIGNED_AT,
		status: "archived",
	},
} as unknown as PortalDealDetail;

export const portalErroredDealDetailFixture = {
	...portalDealDetailFixture,
	documentInstances: portalDealDetailFixture.documentInstances.map(
		(document) =>
			document.class === "private_templated_signable"
				? {
						...document,
						lastError: "Provider rejected the current recipient roster.",
						signing: {
							...document.signing,
							canLaunchEmbeddedSigning: false,
							lastError: "Provider rejected the current recipient roster.",
							status: "provider_error",
						},
						status: "provider_error",
					}
				: document
	),
	documentPackage: {
		...portalDealDetailFixture.documentPackage,
		lastError: "One signable document failed provider envelope creation.",
		retryCount: 2,
		status: "partial_failure",
	},
} as unknown as PortalDealDetail;
