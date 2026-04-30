export type LawyerMatterQueueBucket =
	| "needsRepresentationConfirmation"
	| "needsPackageReview"
	| "awaitingSigners"
	| "completed";

export const LAWYER_MATTER_QUEUE_BUCKETS: readonly {
	key: LawyerMatterQueueBucket;
	label: string;
}[] = [
	{
		key: "needsRepresentationConfirmation",
		label: "Needs Representation Confirmation",
	},
	{ key: "needsPackageReview", label: "Needs Package Review" },
	{ key: "awaitingSigners", label: "Awaiting Signers" },
	{ key: "completed", label: "Completed" },
];

export type LawyerAccessState =
	| "active"
	| "completed_read_only"
	| "access_ended"
	| "unauthorized";

export interface LawyerMatterListItem {
	accessState: LawyerAccessState;
	closingDate: number | null;
	dealId: string;
	status: string;
	updatedAt?: number;
}

export type GroupedLawyerMatters = Record<
	LawyerMatterQueueBucket,
	LawyerMatterListItem[]
>;

export type LawyerActionKey =
	| "confirmRepresentation"
	| "approvePackageForSigning";

export interface LawyerActionState {
	disabledReason: string | null;
	enabled: boolean;
	key: LawyerActionKey;
	label: string;
}

export interface LawyerRepresentationGateState {
	decision: "allow" | "block" | "requires_review";
	message: string;
	reasonCodes: readonly string[];
}

export interface LawyerPackageInstanceState {
	class: string;
	displayName: string;
	signingState?: string;
	status: string;
}

export interface LawyerPackageReviewState {
	instances: readonly LawyerPackageInstanceState[];
	openExceptions: readonly LawyerSigningExceptionState[];
	packageStatus: string | null;
}

export interface LawyerSigningExceptionState {
	createdAt?: number;
	kind: string;
	message?: string;
	raisedAt?: number;
	severity?: "blocking" | "warning" | string;
	status: "open" | "resolved" | string;
}

export interface LawyerRecipientState {
	completedAt?: number;
	documensoRole?: string;
	name: string;
	platformRole: string;
	required: boolean;
	signingOrder: number;
	signingStatus: string;
}

export interface LawyerEnvelopeAttemptState {
	attemptNumber: number;
	createdAt: number;
	recipients: readonly LawyerRecipientState[];
	status: string;
	supersededByAttemptId?: string;
	supersedesAttemptId?: string;
}

export interface LawyerSignerSummary {
	completedRequiredCount: number;
	hasOpenBlockingException: boolean;
	hasReissueHistory: boolean;
	nextSignerNames: string[];
	requiredCount: number;
	statusLabel: string;
}

export interface LawyerTimelineInput {
	attempts: readonly LawyerEnvelopeAttemptState[];
	closeMilestones?: readonly LawyerTimelineMilestone[];
	exceptions: readonly LawyerSigningExceptionState[];
	legalActions: readonly LawyerTimelineMilestone[];
}

export interface LawyerTimelineMilestone {
	at: number;
	description: string;
	title: string;
	type: "legal_action" | "signer_progress" | "document_exception" | "close";
}

export function getLawyerMatterQueueBucket(
	matter: Pick<LawyerMatterListItem, "accessState" | "status">
): LawyerMatterQueueBucket {
	if (
		matter.accessState === "completed_read_only" ||
		matter.status === "confirmed"
	) {
		return "completed";
	}
	if (matter.status === "lawyerOnboarding.verified") {
		return "needsRepresentationConfirmation";
	}
	if (matter.status === "documentReview.pending") {
		return "needsPackageReview";
	}
	return "awaitingSigners";
}

export function groupLawyerMatters(
	matters: readonly LawyerMatterListItem[]
): GroupedLawyerMatters {
	const grouped: GroupedLawyerMatters = {
		needsRepresentationConfirmation: [],
		needsPackageReview: [],
		awaitingSigners: [],
		completed: [],
	};

	for (const matter of matters) {
		grouped[getLawyerMatterQueueBucket(matter)].push(matter);
	}

	for (const bucket of LAWYER_MATTER_QUEUE_BUCKETS) {
		grouped[bucket.key].sort(compareLawyerMatters);
	}

	return grouped;
}

export function isLawyerWorkspaceReadOnly(accessState: LawyerAccessState) {
	return accessState !== "active";
}

export function buildLawyerActionStates(args: {
	accessState: LawyerAccessState;
	packageReview: LawyerPackageReviewState;
	representationGate?: LawyerRepresentationGateState | null;
	status: string;
}): Record<LawyerActionKey, LawyerActionState> {
	const readOnlyReason = readOnlyDisabledReason(args.accessState);
	const representationGateReason =
		args.status === "lawyerOnboarding.verified" &&
		args.representationGate &&
		args.representationGate.decision !== "allow"
			? args.representationGate.message
			: undefined;

	return {
		confirmRepresentation: {
			key: "confirmRepresentation",
			label: "Confirm Representation",
			...actionAvailability({
				readOnlyReason,
				requiredStatus: "lawyerOnboarding.verified",
				status: args.status,
				statusReason:
					"Representation can only be confirmed after lawyer verification.",
				secondaryReason: representationGateReason,
			}),
		},
		approvePackageForSigning: {
			key: "approvePackageForSigning",
			label: "Approve Package For Signing",
			...actionAvailability({
				readOnlyReason,
				requiredStatus: "documentReview.pending",
				status: args.status,
				statusReason:
					"Package approval is only available during document review.",
				secondaryReason: firstPackageApprovalBlocker(args.packageReview),
			}),
		},
	};
}

export function packageApprovalBlockers(
	packageReview: LawyerPackageReviewState
): string[] {
	const blockers: string[] = [];

	if (packageReview.packageStatus !== "ready") {
		blockers.push("Generated package is not ready.");
	}

	const signableInstances = packageReview.instances.filter(
		(instance) => instance.class === "private_templated_signable"
	);
	if (signableInstances.length === 0) {
		blockers.push("No signable package documents are available.");
	}

	if (
		signableInstances.some(
			(instance) =>
				instance.status === "signature_pending_recipient_resolution" ||
				instance.signingState === "pending_recipient_resolution"
		)
	) {
		blockers.push("Signatory mappings are incomplete.");
	}

	if (
		packageReview.openExceptions.some(
			(exception) =>
				exception.status === "open" &&
				exception.kind === "pre_send_configuration_failure"
		)
	) {
		blockers.push("Open pre-send configuration exceptions must be resolved.");
	}

	return blockers;
}

export function summarizeLawyerSigners(args: {
	attempts: readonly LawyerEnvelopeAttemptState[];
	exceptions: readonly LawyerSigningExceptionState[];
}): LawyerSignerSummary {
	const activeAttempt = latestActiveAttempt(args.attempts);
	const recipients = activeAttempt?.recipients ?? [];
	const requiredRecipients = recipients.filter(
		(recipient) => recipient.required
	);
	const completedRequiredCount = requiredRecipients.filter(
		(recipient) => recipient.signingStatus === "completed"
	).length;
	const nextOrder = Math.min(
		...requiredRecipients
			.filter((recipient) => recipient.signingStatus !== "completed")
			.map((recipient) => recipient.signingOrder)
	);
	const nextSignerNames = Number.isFinite(nextOrder)
		? requiredRecipients
				.filter(
					(recipient) =>
						recipient.signingOrder === nextOrder &&
						recipient.signingStatus !== "completed"
				)
				.map((recipient) => recipient.name)
		: [];
	const hasOpenBlockingException = args.exceptions.some(
		(exception) =>
			exception.status === "open" &&
			(exception.severity === undefined || exception.severity === "blocking")
	);
	const hasReissueHistory = args.attempts.some(
		(attempt) =>
			attempt.supersedesAttemptId !== undefined ||
			attempt.supersededByAttemptId !== undefined ||
			attempt.status === "reissue_required"
	);

	return {
		completedRequiredCount,
		hasOpenBlockingException,
		hasReissueHistory,
		nextSignerNames,
		requiredCount: requiredRecipients.length,
		statusLabel: signerStatusLabel({
			activeAttempt,
			completedRequiredCount,
			hasOpenBlockingException,
			requiredCount: requiredRecipients.length,
		}),
	};
}

export function buildLawyerTimeline(
	input: LawyerTimelineInput
): LawyerTimelineMilestone[] {
	const signerMilestones = input.attempts.flatMap((attempt) =>
		attempt.recipients
			.filter((recipient) => recipient.completedAt !== undefined)
			.map((recipient) => ({
				at: recipient.completedAt ?? attempt.createdAt,
				description: `${recipient.name} completed ${recipient.documensoRole ?? "signing"} as ${recipient.platformRole}.`,
				title: "Signer completed",
				type: "signer_progress" as const,
			}))
	);
	const exceptionMilestones = input.exceptions.map((exception) => ({
		at: exception.createdAt ?? exception.raisedAt ?? Date.now(),
		description: exception.message ?? exception.kind,
		title: "Document exception",
		type: "document_exception" as const,
	}));

	return [
		...input.legalActions,
		...signerMilestones,
		...exceptionMilestones,
		...(input.closeMilestones ?? []),
	].sort((left, right) => left.at - right.at);
}

function compareLawyerMatters(
	left: LawyerMatterListItem,
	right: LawyerMatterListItem
) {
	const leftTime = left.closingDate ?? left.updatedAt ?? 0;
	const rightTime = right.closingDate ?? right.updatedAt ?? 0;
	if (leftTime !== rightTime) {
		return leftTime - rightTime;
	}
	return left.dealId.localeCompare(right.dealId);
}

function readOnlyDisabledReason(accessState: LawyerAccessState) {
	if (accessState === "active") {
		return null;
	}
	if (accessState === "completed_read_only") {
		return "This matter is complete and read-only.";
	}
	if (accessState === "access_ended") {
		return "Your active lawyer access for this matter has ended.";
	}
	return "You are not authorized to act on this matter.";
}

function actionAvailability(args: {
	readOnlyReason: string | null;
	requiredStatus: string;
	secondaryReason?: string | null;
	status: string;
	statusReason: string;
}): Pick<LawyerActionState, "disabledReason" | "enabled"> {
	const disabledReason =
		args.readOnlyReason ??
		args.secondaryReason ??
		(args.status === args.requiredStatus ? null : args.statusReason) ??
		null;

	return {
		disabledReason,
		enabled: disabledReason === null,
	};
}

function firstPackageApprovalBlocker(
	packageReview: LawyerPackageReviewState
): string | null {
	return packageApprovalBlockers(packageReview)[0] ?? null;
}

function latestActiveAttempt(
	attempts: readonly LawyerEnvelopeAttemptState[]
): LawyerEnvelopeAttemptState | null {
	const activeAttempts = attempts.filter(
		(attempt) => attempt.supersededByAttemptId === undefined
	);
	return (
		activeAttempts.sort(
			(left, right) => right.attemptNumber - left.attemptNumber
		)[0] ?? null
	);
}

function signerStatusLabel(args: {
	activeAttempt: LawyerEnvelopeAttemptState | null;
	completedRequiredCount: number;
	hasOpenBlockingException: boolean;
	requiredCount: number;
}) {
	if (args.hasOpenBlockingException) {
		return "Exception requires attention";
	}
	if (!args.activeAttempt) {
		return "No envelope attempt";
	}
	if (
		args.requiredCount > 0 &&
		args.completedRequiredCount === args.requiredCount
	) {
		return "All required signers complete";
	}
	if (
		args.activeAttempt.status === "sent" ||
		args.activeAttempt.status === "partially_signed"
	) {
		return "Signing in progress";
	}
	return "Envelope not sent";
}
