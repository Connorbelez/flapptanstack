import { ConvexError, v } from "convex/values";
import { transition as computeTransition } from "xstate";
import type { Doc, Id } from "../_generated/dataModel";
import {
	internalMutation,
	internalQuery,
	type QueryCtx,
} from "../_generated/server";
import { assertDealAccess } from "../authz/resourceAccess";
import { readDealDocumentPackageSurface } from "../documents/dealPackages";
import { dealMachine } from "../engine/machines/deal.machine";
import { deserializeState, serializeState } from "../engine/serialization";
import { adminQuery, authedQuery, dealQuery } from "../fluent";
import {
	buildLegalRepresentationStatusProjection,
	type LegalRepresentationStatusProjection,
} from "../legalRepresentation/status";
import {
	projectFundsSourceForAdmin,
	type projectFundsSourceForParticipant,
	type SignedArchiveStatus,
} from "./closeEvidence";
import {
	canExposeEmbeddedSigningToken,
	isSigningOrderAvailable,
	summarizeRequiredRecipientCompletion,
} from "./envelopes";
import {
	buildDealParticipantProjection,
	type DealParticipantProjection,
	projectFractionalShareUnits,
} from "./participantProjection";

// ── Phase mapping ──────────────────────────────────────────────────────

type DealPhase =
	| "initiated"
	| "lawyerOnboarding"
	| "documentReview"
	| "fundsTransfer"
	| "confirmed"
	| "failed"
	| "unknown";

const KNOWN_DEAL_STATUSES = new Set([
	"initiated",
	"lawyerOnboarding.pending",
	"lawyerOnboarding.verified",
	"lawyerOnboarding.complete",
	"documentReview.pending",
	"documentReview.signed",
	"documentReview.complete",
	"fundsTransfer.pending",
	"fundsTransfer.complete",
	"confirmed",
	"failed",
]);

function getDealPhase(status: string): DealPhase {
	if (!KNOWN_DEAL_STATUSES.has(status)) {
		return "unknown";
	}
	if (status === "initiated") {
		return "initiated";
	}
	if (status.startsWith("lawyerOnboarding.")) {
		return "lawyerOnboarding";
	}
	if (status.startsWith("documentReview.")) {
		return "documentReview";
	}
	if (status.startsWith("fundsTransfer.")) {
		return "fundsTransfer";
	}
	if (status === "confirmed") {
		return "confirmed";
	}
	if (status === "failed") {
		return "failed";
	}
	return "unknown";
}

export interface DealWithPhase {
	_id: Id<"deals">;
	buyerId: string;
	closingDate?: number;
	createdAt: number;
	createdBy: string;
	fractionalShare: number;
	fractionalShareDisplayPercent: number | null;
	fractionalShareUnits: number;
	lawyerId?: string;
	lawyerType?: "platform_lawyer" | "guest_lawyer";
	mortgageId: Id<"mortgages">;
	sellerId: string;
	status: string;
}

export interface DealsByPhase {
	confirmed: DealWithPhase[];
	documentReview: DealWithPhase[];
	failed: DealWithPhase[];
	fundsTransfer: DealWithPhase[];
	initiated: DealWithPhase[];
	lawyerOnboarding: DealWithPhase[];
	unknown: DealWithPhase[];
}

export type AdminDealOperationsFilter =
	| "all"
	| "needs_action"
	| "blocked"
	| "awaiting_signatures"
	| "awaiting_funds"
	| "completed"
	| "failed";

export type AdminDealOperationBlockerKind =
	| "missing_contract"
	| "missing_participant"
	| "missing_lawyer_access"
	| "invalid_fraction"
	| "package_pending"
	| "package_failed"
	| "signing_exception"
	| "funds_pending"
	| "archive_blocked"
	| "close_effect_attention";

interface AdminDealOperationActionBase {
	disabledReason: string | null;
	label: string;
}

export type AdminDealOperationAction =
	| (AdminDealOperationActionBase & {
			event: "DEAL_LOCKED";
			payloadKind: "closing_date";
			requiresPayload: true;
			source: "governed_transition";
	  })
	| (AdminDealOperationActionBase & {
			event: "LAWYER_VERIFIED";
			payloadKind: "verification_id";
			requiresPayload: true;
			source: "governed_transition";
	  })
	| (AdminDealOperationActionBase & {
			event:
				| "REPRESENTATION_CONFIRMED"
				| "LAWYER_APPROVED_DOCUMENTS"
				| "ALL_PARTIES_SIGNED";
			payloadKind: "none";
			requiresPayload: false;
			source: "governed_transition";
	  })
	| (AdminDealOperationActionBase & {
			event: "FUNDS_RECEIVED";
			payloadKind: "manual_funds";
			requiresPayload: true;
			source: "manual_funds_confirmation";
	  })
	| (AdminDealOperationActionBase & {
			event: "DEAL_CANCELLED";
			payloadKind: "cancel_reason";
			requiresPayload: true;
			source: "governed_transition";
	  });

export interface AdminDealOperationBlocker {
	kind: AdminDealOperationBlockerKind;
	message: string;
	severity: "info" | "warning" | "critical";
}

export interface AdminDealOperationsCard {
	_id: Id<"deals">;
	actions: AdminDealOperationAction[];
	blockers: AdminDealOperationBlocker[];
	closingDate: number | null;
	closingTeam: Array<{
		assignedAt: number;
		role: Doc<"closingTeamAssignments">["role"];
		userId: string;
	}>;
	createdAt: number;
	createdBy: string;
	filters: AdminDealOperationsFilter[];
	fractionalShareDisplayPercent: number | null;
	fractionalShareUnits: number;
	legalRepresentation: LegalRepresentationStatusProjection;
	lifecycle: {
		phase: DealPhase;
		status: string;
		subState: string | null;
	};
	mortgageId: Id<"mortgages">;
	nextAction: AdminDealOperationAction | null;
	participants: Pick<
		DealParticipantProjection,
		"buyer" | "seller" | "lawyer" | "fractionalShareStatus"
	>;
	signing: {
		activeAttemptId: Id<"dealEnvelopeAttempts"> | null;
		completedRequiredCount: number;
		exceptionCount: number;
		requiredCount: number;
		status: string;
	};
}

export interface AdminDealOperationsProjection {
	cards: AdminDealOperationsCard[];
	columns: DealsByPhase;
	filters: Record<AdminDealOperationsFilter, number>;
}

export interface AdminDealOperationsDetail {
	access: {
		active: Array<{
			grantedAt: number;
			role: Doc<"dealAccess">["role"];
			userId: string;
		}>;
		revoked: Array<{
			grantedAt: number;
			revokedAt: number | null;
			role: Doc<"dealAccess">["role"];
			userId: string;
		}>;
	};
	auditTimeline: Array<{
		eventId: string;
		eventType: string;
		newState: string | null;
		outcome: string;
		previousState: string | null;
		reason: string | null;
		timestamp: number;
	}>;
	blockers: AdminDealOperationBlocker[];
	closeEvidence: AdminCloseEvidenceProjection;
	deal: {
		closingDate: number | null;
		createdAt: number;
		dealId: Id<"deals">;
		fractionalShareDisplayPercent: number | null;
		fractionalShareUnits: number;
		lockingFeeAmount: number | null;
		reservationId: Id<"ledger_reservations"> | null;
		status: string;
	};
	documentInstances: PortalDealDocumentInstance[];
	documentPackage: PortalDealDocumentPackage | null;
	legalRepresentation: LegalRepresentationStatusProjection;
	lifecycle: {
		phase: DealPhase;
		status: string;
		subState: string | null;
	};
	mortgage: {
		maturityDate: string;
		mortgageId: Id<"mortgages">;
		paymentAmount: number;
		paymentFrequency: string;
		principal: number;
		status: string;
	} | null;
	nextActions: AdminDealOperationAction[];
	participants: DealParticipantProjection;
	property: PortalDealDetail["property"];
	signing: {
		activeAttemptId: Id<"dealEnvelopeAttempts"> | null;
		attempts: Array<{
			active: boolean;
			attemptId: Id<"dealEnvelopeAttempts">;
			attemptNumber: number;
			providerDocumentId: string | null;
			providerEnvelopeId: string | null;
			status: string;
			terminalReason: string | null;
			updatedAt: number;
		}>;
		exceptions: Array<{
			kind: string;
			message: string;
			severity: string;
			status: string;
			updatedAt: number;
		}>;
		recipients: Array<{
			completedAt: number | null;
			documensoRole: string;
			name: string;
			platformRole: string;
			required: boolean;
			signingOrder: number;
			signingStatus: string;
		}>;
		status: string;
	};
}

type DealDocumentPackageSurface = Awaited<
	ReturnType<typeof readDealDocumentPackageSurface>
>;
type DealDocumentPackageSurfaceInstance =
	DealDocumentPackageSurface["instances"][number];

export interface PortalDealDocumentInstance {
	archivedAt: number | null;
	archivedSigning: DealDocumentPackageSurfaceInstance["archivedSigning"];
	class: DealDocumentPackageSurfaceInstance["class"];
	displayName: string;
	instanceId: DealDocumentPackageSurfaceInstance["instanceId"];
	kind: DealDocumentPackageSurfaceInstance["kind"];
	lastError: string | null;
	packageLabel: string | null;
	signing: DealDocumentPackageSurfaceInstance["signing"];
	signingState: DealDocumentPackageSurfaceInstance["signingState"];
	status: DealDocumentPackageSurfaceInstance["status"];
	url: string | null;
}

export interface PortalDealDocumentPackage {
	archivedAt: number | null;
	lastError: string | null;
	readyAt: number | null;
	retryCount: number;
	status: NonNullable<DealDocumentPackageSurface["package"]>["status"];
}

export interface PortalDealDetail {
	closeReceipt: ParticipantCloseReceiptSummary;
	deal: {
		closingDate: number | null;
		dealId: Id<"deals">;
		/** @deprecated Use fractionalShareUnits or fractionalShareDisplayPercent. */
		fractionalShare: number;
		fractionalShareDisplayPercent: number | null;
		fractionalShareUnits: number;
		lockingFeeAmount: number | null;
		status: string;
	};
	documentInstances: PortalDealDocumentInstance[];
	documentPackage: PortalDealDocumentPackage | null;
	mortgage: {
		interestRate: number;
		maturityDate: string;
		mortgageId: Id<"mortgages">;
		paymentAmount: number;
		paymentFrequency: string;
		principal: number;
		status: string;
	};
	participants: DealParticipantProjection;
	parties: {
		lender: {
			email: string | null;
			name: string;
		};
		seller: {
			email: string | null;
			name: string;
		};
	};
	property: {
		city: string;
		propertyType: string;
		province: string;
		streetAddress: string;
		unit: string | null;
	} | null;
}

export interface CloseEffectOutcomeProjection {
	effectName: string;
	exceptionKind: string | null;
	message: string | null;
	status: string;
	updatedAt: number;
}

export interface AdminCloseEvidenceProjection {
	archives: Array<{
		archiveId: Id<"dealSignedArchives">;
		status: SignedArchiveStatus;
		assetIds: Id<"documentAssets">[];
		storageIds: Id<"_storage">[];
		blockerKind: string | null;
		blockerMessage: string | null;
		archivedAt: number | null;
		updatedAt: number;
	}>;
	effectOutcomes: CloseEffectOutcomeProjection[];
	funds: ReturnType<typeof projectFundsSourceForAdmin> | null;
}

export interface ParticipantCloseReceiptSummary {
	closedAt: number | null;
	funds: ReturnType<typeof projectFundsSourceForParticipant> | null;
	signedArchiveStatus: SignedArchiveStatus | null;
}

export type ParticipantWorkspacePersona =
	| "purchasing_lender"
	| "selling_lender"
	| "participating_lender";
export type ParticipantQueueGroupName =
	| "needsAction"
	| "inProgress"
	| "completed";
export type ParticipantSigningStatus =
	| "not_started"
	| "package_pending"
	| "package_failed"
	| "upcoming"
	| "blocked"
	| "ready_to_sign"
	| "token_expired"
	| "token_unavailable"
	| "envelope_exception"
	| "completed";

interface ParticipantSigningRecipientProjection {
	completedAt: number | null;
	documensoRole: string;
	name: string;
	platformRole: string;
	required: boolean;
	signingOrder: number;
	signingStatus: string;
}

interface ParticipantSigningTaskProjection {
	attemptId: Id<"dealEnvelopeAttempts"> | null;
	completedRequiredCount: number;
	embeddedSigningToken: string | null;
	exceptionMessage: string | null;
	providerDocumentId: string | null;
	providerEnvelopeId: string | null;
	recipientName: string | null;
	requiredCount: number;
	status: ParticipantSigningStatus;
	tokenExpiresAt: number | null;
}

interface ParticipantTimelineEntry {
	at: number | null;
	description: string;
	label: string;
	status: "complete" | "current" | "upcoming" | "blocked";
}

interface ParticipantWorkspaceBlocker {
	kind:
		| "package_pending"
		| "package_failed"
		| "envelope_exception"
		| "token_expired"
		| "receipt_pending";
	message: string;
}

export interface ParticipantDealQueueItem {
	closingDate: number | null;
	dealId: Id<"deals">;
	group: ParticipantQueueGroupName;
	nextAction: string;
	persona: ParticipantWorkspacePersona;
	propertyLabel: string;
	signingStatus: ParticipantSigningStatus;
	status: string;
}

export interface ParticipantDealQueue {
	completed: ParticipantDealQueueItem[];
	inProgress: ParticipantDealQueueItem[];
	needsAction: ParticipantDealQueueItem[];
	persona: ParticipantWorkspacePersona;
}

export interface ParticipantDealWorkspace {
	blockers: ParticipantWorkspaceBlocker[];
	closeReceipt: ParticipantCloseReceiptSummary;
	deal: PortalDealDetail["deal"] & {
		persona: ParticipantWorkspacePersona;
	};
	documentInstances: PortalDealDocumentInstance[];
	documentPackage: PortalDealDocumentPackage | null;
	legalRepresentation: LegalRepresentationStatusProjection;
	mortgage: PortalDealDetail["mortgage"];
	nextAction: string;
	participants: DealParticipantProjection;
	parties: PortalDealDetail["parties"] & {
		assignedLawyer: {
			email: string | null;
			name: string | null;
		};
	};
	persona: ParticipantWorkspacePersona;
	property: PortalDealDetail["property"];
	queueGroup: ParticipantQueueGroupName;
	signing: ParticipantSigningTaskProjection & {
		recipients: ParticipantSigningRecipientProjection[];
	};
	timeline: ParticipantTimelineEntry[];
}

function projectPortalDealDocumentInstance(
	instance: DealDocumentPackageSurfaceInstance
): PortalDealDocumentInstance {
	return {
		archivedSigning: instance.archivedSigning,
		archivedAt: instance.archivedAt,
		class: instance.class,
		displayName: instance.displayName,
		instanceId: instance.instanceId,
		kind: instance.kind,
		lastError: instance.lastError,
		packageLabel: instance.packageLabel,
		signing: instance.signing,
		signingState: instance.signingState,
		status: instance.status,
		url:
			instance.status === "available" ||
			instance.status === "archived" ||
			instance.archivedSigning?.finalPdfUrl
				? instance.url
				: null,
	};
}

async function readCloseEvidenceProjection(
	ctx: Pick<QueryCtx, "db">,
	dealId: Id<"deals">
): Promise<AdminCloseEvidenceProjection> {
	const [fundsEvidence, archives, effectOutcomes] = await Promise.all([
		ctx.db
			.query("dealFundsEvidence")
			.withIndex("by_deal", (query) => query.eq("dealId", dealId))
			.collect(),
		ctx.db
			.query("dealSignedArchives")
			.withIndex("by_deal", (query) => query.eq("dealId", dealId))
			.collect(),
		ctx.db
			.query("dealCloseEffectOutcomes")
			.withIndex("by_deal", (query) => query.eq("dealId", dealId))
			.collect(),
	]);

	const latestFunds =
		fundsEvidence.sort(
			(left, right) => right.recordedAt - left.recordedAt
		)[0] ?? null;

	return {
		funds: latestFunds
			? projectFundsSourceForAdmin({
					source: latestFunds.source,
					receivedAt: latestFunds.receivedAt,
					recordedAt: latestFunds.recordedAt,
				})
			: null,
		archives: archives
			.sort((left, right) => right.updatedAt - left.updatedAt)
			.map((archive) => ({
				archiveId: archive._id,
				status: archive.status,
				assetIds: archive.assetIds,
				storageIds: archive.storageIds,
				blockerKind: archive.blockerKind ?? null,
				blockerMessage: archive.blockerMessage ?? null,
				archivedAt: archive.archivedAt ?? null,
				updatedAt: archive.updatedAt,
			})),
		effectOutcomes: effectOutcomes
			.sort((left, right) => right.updatedAt - left.updatedAt)
			.map((outcome) => ({
				effectName: outcome.effectName,
				status: outcome.status,
				exceptionKind: outcome.exceptionKind ?? null,
				message: outcome.message ?? null,
				updatedAt: outcome.updatedAt,
			})),
	};
}

function toParticipantCloseReceipt(
	deal: { lastTransitionAt?: number; status: string },
	closeEvidence: AdminCloseEvidenceProjection
): ParticipantCloseReceiptSummary {
	const latestSuccessfulArchive =
		closeEvidence.archives.find((archive) => archive.status === "archived") ??
		null;
	const hasReceiptEvidence = Boolean(
		closeEvidence.funds || latestSuccessfulArchive
	);
	return {
		closedAt:
			deal.status === "confirmed" && hasReceiptEvidence
				? (deal.lastTransitionAt ?? null)
				: null,
		funds: closeEvidence.funds
			? {
					sourceKind: closeEvidence.funds.sourceKind,
					receivedAt: closeEvidence.funds.receivedAt,
					recordedAt: closeEvidence.funds.recordedAt,
					providerCode:
						"providerCode" in closeEvidence.funds
							? closeEvidence.funds.providerCode
							: undefined,
				}
			: null,
		signedArchiveStatus: latestSuccessfulArchive?.status ?? null,
	};
}

function subStateForStatus(status: string): string | null {
	if (!KNOWN_DEAL_STATUSES.has(status)) {
		return "missing_contract";
	}
	if (status === "initiated") {
		return "pending";
	}
	if (status === "confirmed") {
		return "complete";
	}
	if (status === "failed") {
		return "terminated";
	}
	const [, subState] = status.split(".");
	return subState ?? null;
}

function actionEventForTransitionCheck(action: AdminDealOperationAction) {
	if (action.event === "DEAL_LOCKED") {
		return { type: action.event, closingDate: 1 };
	}
	if (action.event === "LAWYER_VERIFIED") {
		return { type: action.event, verificationId: "admin-projection" };
	}
	if (action.event === "FUNDS_RECEIVED") {
		return { type: action.event, method: "manual" as const };
	}
	if (action.event === "DEAL_CANCELLED") {
		return { type: action.event, reason: "admin projection" };
	}
	return { type: action.event };
}

function canTransitionFromStatus(
	status: string,
	action: AdminDealOperationAction
) {
	if (!KNOWN_DEAL_STATUSES.has(status)) {
		return false;
	}
	try {
		const currentSnapshot = dealMachine.resolveState({
			value: deserializeState(status) as Parameters<
				typeof dealMachine.resolveState
			>[0]["value"],
			context: { dealId: "admin-operations-projection" },
		});
		const [nextSnapshot, transitionActions] = computeTransition(
			dealMachine,
			currentSnapshot,
			actionEventForTransitionCheck(action)
		);
		return (
			serializeState(nextSnapshot.value) !==
				serializeState(currentSnapshot.value) || transitionActions.length > 0
		);
	} catch {
		return false;
	}
}

const ADMIN_DEAL_ACTION_DEFINITIONS: readonly AdminDealOperationAction[] = [
	{
		disabledReason: null,
		event: "DEAL_LOCKED",
		label: "Lock Deal",
		payloadKind: "closing_date",
		requiresPayload: true,
		source: "governed_transition",
	},
	{
		disabledReason: null,
		event: "LAWYER_VERIFIED",
		label: "Verify Lawyer",
		payloadKind: "verification_id",
		requiresPayload: true,
		source: "governed_transition",
	},
	{
		disabledReason: null,
		event: "REPRESENTATION_CONFIRMED",
		label: "Confirm Representation",
		payloadKind: "none",
		requiresPayload: false,
		source: "governed_transition",
	},
	{
		disabledReason: null,
		event: "LAWYER_APPROVED_DOCUMENTS",
		label: "Approve Documents",
		payloadKind: "none",
		requiresPayload: false,
		source: "governed_transition",
	},
	{
		disabledReason: null,
		event: "ALL_PARTIES_SIGNED",
		label: "Confirm All Signed",
		payloadKind: "none",
		requiresPayload: false,
		source: "governed_transition",
	},
	{
		disabledReason: null,
		event: "FUNDS_RECEIVED",
		label: "Confirm Funds Received",
		payloadKind: "manual_funds",
		requiresPayload: true,
		source: "manual_funds_confirmation",
	},
	{
		disabledReason: null,
		event: "DEAL_CANCELLED",
		label: "Cancel Deal",
		payloadKind: "cancel_reason",
		requiresPayload: true,
		source: "governed_transition",
	},
] as const;

function legalGateDisabledReason(args: {
	action: AdminDealOperationAction;
	legalRepresentation: LegalRepresentationStatusProjection;
}) {
	if (
		args.action.event === "LAWYER_VERIFIED" &&
		args.legalRepresentation.gate.reasonCodes.includes(
			"selected_lawyer_missing"
		)
	) {
		return args.legalRepresentation.gate.message;
	}

	return null;
}

function dealActionsForStatus(
	status: string,
	legalRepresentation?: LegalRepresentationStatusProjection
): AdminDealOperationAction[] {
	return ADMIN_DEAL_ACTION_DEFINITIONS.filter((action) =>
		canTransitionFromStatus(status, action)
	).map((action) => {
		if (!legalRepresentation) {
			return action;
		}
		const disabledReason = legalGateDisabledReason({
			action,
			legalRepresentation,
		});
		return disabledReason ? { ...action, disabledReason } : action;
	});
}

function actionableActions(actions: AdminDealOperationAction[]) {
	return actions.filter((action) => !action.disabledReason);
}

function nonCancelActions(actions: AdminDealOperationAction[]) {
	return actions.filter(
		(action) => action.event !== "DEAL_CANCELLED" && !action.disabledReason
	);
}

async function readDealAccessProjection(
	ctx: Pick<QueryCtx, "db">,
	dealId: Id<"deals">
) {
	const rows = await ctx.db
		.query("dealAccess")
		.withIndex("by_deal", (query) => query.eq("dealId", dealId))
		.collect();
	return {
		active: rows
			.filter((row) => row.status === "active")
			.sort((left, right) => right.grantedAt - left.grantedAt)
			.map((row) => ({
				grantedAt: row.grantedAt,
				role: row.role,
				userId: row.userId,
			})),
		revoked: rows
			.filter((row) => row.status === "revoked")
			.sort((left, right) => (right.revokedAt ?? 0) - (left.revokedAt ?? 0))
			.map((row) => ({
				grantedAt: row.grantedAt,
				revokedAt: row.revokedAt ?? null,
				role: row.role,
				userId: row.userId,
			})),
	};
}

async function readClosingTeamProjection(
	ctx: Pick<QueryCtx, "db">,
	mortgageId: Id<"mortgages">
): Promise<AdminDealOperationsCard["closingTeam"]> {
	const assignments = await ctx.db
		.query("closingTeamAssignments")
		.withIndex("by_mortgage", (query) => query.eq("mortgageId", mortgageId))
		.collect();
	return assignments
		.sort((left, right) => right.assignedAt - left.assignedAt)
		.map((assignment) => ({
			assignedAt: assignment.assignedAt,
			role: assignment.role,
			userId: assignment.userId,
		}));
}

async function readAuditTimeline(
	ctx: Pick<QueryCtx, "db">,
	dealId: Id<"deals">
) {
	const events = await ctx.db
		.query("auditJournal")
		.withIndex("by_entity", (query) =>
			query.eq("entityType", "deal").eq("entityId", String(dealId))
		)
		.collect();
	return events
		.sort((left, right) => right.timestamp - left.timestamp)
		.slice(0, 20)
		.map((event) => ({
			eventId: event.eventId,
			eventType: event.eventType,
			newState: event.newState ?? null,
			outcome: event.outcome,
			previousState: event.previousState ?? null,
			reason: event.reason ?? null,
			timestamp: event.timestamp,
		}));
}

async function readAdminSigningProjection(
	ctx: Pick<QueryCtx, "db">,
	dealId: Id<"deals">
): Promise<AdminDealOperationsDetail["signing"]> {
	const [attempts, recipients, exceptions] = await Promise.all([
		ctx.db
			.query("dealEnvelopeAttempts")
			.withIndex("by_deal", (query) => query.eq("dealId", dealId))
			.collect(),
		ctx.db
			.query("dealEnvelopeRecipients")
			.withIndex("by_deal", (query) => query.eq("dealId", dealId))
			.collect(),
		ctx.db
			.query("dealSigningExceptions")
			.withIndex("by_deal", (query) => query.eq("dealId", dealId))
			.collect(),
	]);
	const sortedAttempts = attempts.sort(
		(left, right) => right.attemptNumber - left.attemptNumber
	);
	const activeAttempt =
		sortedAttempts.find((attempt) => attempt.active) ??
		sortedAttempts[0] ??
		null;
	const activeRecipients = activeAttempt
		? recipients
				.filter((recipient) => recipient.attemptId === activeAttempt._id)
				.sort((left, right) => {
					if (left.signingOrder !== right.signingOrder) {
						return left.signingOrder - right.signingOrder;
					}
					return left.createdAt - right.createdAt;
				})
		: [];
	const openExceptions = exceptions.filter(
		(exception) => exception.status === "open"
	);
	const status =
		openExceptions.length > 0
			? "envelope_exception"
			: (activeAttempt?.status ?? "not_started");

	return {
		activeAttemptId: activeAttempt?._id ?? null,
		attempts: sortedAttempts.map((attempt) => ({
			active: attempt.active,
			attemptId: attempt._id,
			attemptNumber: attempt.attemptNumber,
			providerDocumentId: attempt.providerDocumentId ?? null,
			providerEnvelopeId: attempt.providerEnvelopeId ?? null,
			status: attempt.status,
			terminalReason: attempt.terminalReason ?? null,
			updatedAt: attempt.updatedAt,
		})),
		exceptions: exceptions
			.sort((left, right) => right.updatedAt - left.updatedAt)
			.map((exception) => ({
				kind: exception.kind,
				message: exception.message,
				severity: exception.severity,
				status: exception.status,
				updatedAt: exception.updatedAt,
			})),
		recipients: activeRecipients.map((recipient) => ({
			completedAt: recipient.completedAt ?? null,
			documensoRole: recipient.documensoRole,
			name: recipient.name,
			platformRole: recipient.platformRole,
			required: recipient.required,
			signingOrder: recipient.signingOrder,
			signingStatus: recipient.signingStatus,
		})),
		status,
	};
}

function signingSummary(
	signing: AdminDealOperationsDetail["signing"]
): AdminDealOperationsCard["signing"] {
	const requiredRecipients = signing.recipients.filter(
		(recipient) => recipient.required
	);
	return {
		activeAttemptId: signing.activeAttemptId,
		completedRequiredCount: requiredRecipients.filter(
			(recipient) => recipient.signingStatus === "completed"
		).length,
		exceptionCount: signing.exceptions.filter(
			(exception) => exception.status === "open"
		).length,
		requiredCount: requiredRecipients.length,
		status: signing.status,
	};
}

function packageBlockers(
	packageSurface: DealDocumentPackageSurface
): AdminDealOperationBlocker[] {
	const packageStatusValue = packageSurface.package?.status ?? null;
	if (packageStatusValue === null || packageStatusValue === "pending") {
		return [
			{
				kind: "package_pending",
				message: "Closing package has not been generated yet.",
				severity: "info",
			},
		];
	}
	if (
		packageStatusValue === "failed" ||
		packageStatusValue === "partial_failure"
	) {
		return [
			{
				kind: "package_failed",
				message:
					packageSurface.package?.lastError ??
					"Closing package generation needs attention.",
				severity: "critical",
			},
		];
	}
	return [];
}

function participantBlockers(
	participants: DealParticipantProjection
): AdminDealOperationBlocker[] {
	const blockers: AdminDealOperationBlocker[] = [];
	if (!participants.fractionalShareStatus.isValid) {
		blockers.push({
			kind: "invalid_fraction",
			message:
				participants.fractionalShareStatus.validationError ??
				"Fractional share units are invalid.",
			severity: "critical",
		});
	}
	if (!participants.buyer.userId) {
		blockers.push({
			kind: "missing_participant",
			message: "Buyer identity is unresolved.",
			severity: "warning",
		});
	}
	if (!participants.seller.userId) {
		blockers.push({
			kind: "missing_participant",
			message: "Seller identity is unresolved.",
			severity: "warning",
		});
	}
	if (participants.lawyer.authId && !participants.lawyer.hasActiveDealAccess) {
		blockers.push({
			kind: "missing_lawyer_access",
			message: "Assigned lawyer does not have active deal access.",
			severity: "warning",
		});
	}
	return blockers;
}

function signingBlockers(
	signing: AdminDealOperationsDetail["signing"]
): AdminDealOperationBlocker[] {
	const openSigningException = signing.exceptions.find(
		(exception) => exception.status === "open"
	);
	if (!openSigningException) {
		return [];
	}
	return [
		{
			kind: "signing_exception",
			message: openSigningException.message,
			severity:
				openSigningException.severity === "critical" ? "critical" : "warning",
		},
	];
}

function closeEvidenceBlockers(args: {
	closeEvidence: AdminCloseEvidenceProjection;
	deal: Doc<"deals">;
}): AdminDealOperationBlocker[] {
	const blockers: AdminDealOperationBlocker[] = [];
	if (
		args.deal.status === "fundsTransfer.pending" &&
		!args.closeEvidence.funds
	) {
		blockers.push({
			kind: "funds_pending",
			message: "Funds receipt evidence has not been recorded.",
			severity: "warning",
		});
	}
	for (const archive of args.closeEvidence.archives) {
		if (archive.status !== "archived") {
			blockers.push({
				kind: "archive_blocked",
				message:
					archive.blockerMessage ?? "Signed archive is not available yet.",
				severity: archive.status === "failed" ? "critical" : "warning",
			});
		}
	}
	for (const outcome of args.closeEvidence.effectOutcomes) {
		if (outcome.status === "blocked" || outcome.status === "failed") {
			blockers.push({
				kind: "close_effect_attention",
				message:
					outcome.message ??
					`${outcome.effectName} close effect requires attention.`,
				severity: outcome.status === "failed" ? "critical" : "warning",
			});
		}
	}
	return blockers;
}

function contractBlockers(args: {
	deal: Doc<"deals">;
	mortgage: Doc<"mortgages"> | null;
}): AdminDealOperationBlocker[] {
	const blockers: AdminDealOperationBlocker[] = [];
	if (!KNOWN_DEAL_STATUSES.has(args.deal.status)) {
		blockers.push({
			kind: "missing_contract",
			message: `Deal status "${args.deal.status}" is not recognized by the governed deal machine.`,
			severity: "critical",
		});
	}
	if (!args.mortgage) {
		blockers.push({
			kind: "missing_contract",
			message: "Deal references a mortgage row that no longer exists.",
			severity: "critical",
		});
	}
	return blockers;
}

function buildAdminDealBlockers(args: {
	closeEvidence: AdminCloseEvidenceProjection;
	deal: Doc<"deals">;
	mortgage: Doc<"mortgages"> | null;
	packageSurface: DealDocumentPackageSurface;
	participants: DealParticipantProjection;
	signing: AdminDealOperationsDetail["signing"];
}): AdminDealOperationBlocker[] {
	return [
		...contractBlockers(args),
		...participantBlockers(args.participants),
		...packageBlockers(args.packageSurface),
		...signingBlockers(args.signing),
		...closeEvidenceBlockers(args),
	];
}

function filtersForCard(args: {
	blockers: AdminDealOperationBlocker[];
	deal: Doc<"deals">;
	nonCancelActionCount: number;
	signing: AdminDealOperationsCard["signing"];
}): AdminDealOperationsFilter[] {
	const filters: AdminDealOperationsFilter[] = ["all"];
	if (args.nonCancelActionCount > 0) {
		filters.push("needs_action");
	}
	if (args.blockers.length > 0) {
		filters.push("blocked");
	}
	if (
		args.signing.status === "sent" ||
		args.signing.status === "partially_signed" ||
		args.signing.status === "envelope_exception"
	) {
		filters.push("awaiting_signatures");
	}
	if (args.deal.status === "fundsTransfer.pending") {
		filters.push("awaiting_funds");
	}
	if (args.deal.status === "confirmed") {
		filters.push("completed");
	}
	if (args.deal.status === "failed") {
		filters.push("failed");
	}
	return filters;
}

async function buildAdminDealOperationsDetail(
	ctx: QueryCtx,
	deal: Doc<"deals">,
	viewerUserId?: Id<"users">
): Promise<AdminDealOperationsDetail | null> {
	const mortgage = await ctx.db.get(deal.mortgageId);
	const [
		property,
		participants,
		packageSurface,
		closeEvidence,
		access,
		auditTimeline,
		legalRepresentation,
	] = await Promise.all([
		mortgage ? ctx.db.get(mortgage.propertyId) : Promise.resolve(null),
		buildDealParticipantProjection(ctx, deal),
		readDealDocumentPackageSurface(ctx, deal._id, {
			isFairLendAdmin: true,
			userId: viewerUserId,
		}),
		readCloseEvidenceProjection(ctx, deal._id),
		readDealAccessProjection(ctx, deal._id),
		readAuditTimeline(ctx, deal._id),
		buildLegalRepresentationStatusProjection(ctx, { deal }),
	]);
	const signing = await readAdminSigningProjection(ctx, deal._id);
	const blockers = buildAdminDealBlockers({
		closeEvidence,
		deal,
		mortgage,
		packageSurface,
		participants,
		signing,
	});
	return {
		access,
		auditTimeline,
		blockers,
		closeEvidence,
		deal: {
			closingDate: deal.closingDate ?? null,
			createdAt: deal.createdAt,
			dealId: deal._id,
			fractionalShareDisplayPercent: participants.fractionalShareDisplayPercent,
			fractionalShareUnits: participants.fractionalShareUnits,
			lockingFeeAmount: deal.lockingFeeAmount ?? null,
			reservationId: deal.reservationId ?? null,
			status: deal.status,
		},
		documentInstances: packageSurface.instances.map(
			projectPortalDealDocumentInstance
		),
		documentPackage: packageSurface.package
			? {
					archivedAt: packageSurface.package.archivedAt,
					lastError: packageSurface.package.lastError,
					readyAt: packageSurface.package.readyAt,
					retryCount: packageSurface.package.retryCount,
					status: packageSurface.package.status,
				}
			: null,
		lifecycle: {
			phase: getDealPhase(deal.status),
			status: deal.status,
			subState: subStateForStatus(deal.status),
		},
		legalRepresentation,
		mortgage: mortgage
			? {
					maturityDate: mortgage.maturityDate,
					mortgageId: mortgage._id,
					paymentAmount: mortgage.paymentAmount,
					paymentFrequency: mortgage.paymentFrequency,
					principal: mortgage.principal,
					status: mortgage.status,
				}
			: null,
		nextActions: dealActionsForStatus(deal.status, legalRepresentation),
		participants,
		property: property
			? {
					city: property.city,
					propertyType: property.propertyType,
					province: property.province,
					streetAddress: property.streetAddress,
					unit: property.unit ?? null,
				}
			: null,
		signing,
	};
}

async function buildAdminDealOperationsCard(
	ctx: QueryCtx,
	deal: Doc<"deals">,
	viewerUserId?: Id<"users">
): Promise<AdminDealOperationsCard | null> {
	const detail = await buildAdminDealOperationsDetail(ctx, deal, viewerUserId);
	if (!detail) {
		return null;
	}
	const actions = actionableActions(detail.nextActions);
	const primaryActions = nonCancelActions(actions);
	const signing = signingSummary(detail.signing);
	return {
		_id: deal._id,
		actions,
		blockers: detail.blockers,
		closingDate: deal.closingDate ?? null,
		closingTeam: await readClosingTeamProjection(ctx, deal.mortgageId),
		createdAt: deal.createdAt,
		createdBy: deal.createdBy,
		filters: filtersForCard({
			blockers: detail.blockers,
			deal,
			nonCancelActionCount: primaryActions.length,
			signing,
		}),
		fractionalShareDisplayPercent:
			detail.participants.fractionalShareDisplayPercent,
		fractionalShareUnits: detail.participants.fractionalShareUnits,
		legalRepresentation: detail.legalRepresentation,
		lifecycle: detail.lifecycle,
		mortgageId: deal.mortgageId,
		nextAction: primaryActions[0] ?? null,
		participants: {
			buyer: detail.participants.buyer,
			fractionalShareStatus: detail.participants.fractionalShareStatus,
			lawyer: detail.participants.lawyer,
			seller: detail.participants.seller,
		},
		signing,
	};
}

function hasParticipantCloseReceiptEvidence(
	closeReceipt: ParticipantCloseReceiptSummary
) {
	return Boolean(
		closeReceipt.closedAt ||
			closeReceipt.funds ||
			closeReceipt.signedArchiveStatus === "archived"
	);
}

function canonicalLenderPersonaForViewer(
	deal: Doc<"deals">,
	viewerAuthId: string
): Exclude<ParticipantWorkspacePersona, "participating_lender"> | null {
	const purchasingLenderAuthId =
		"purchasingLenderAuthId" in deal && deal.purchasingLenderAuthId
			? deal.purchasingLenderAuthId
			: deal.buyerId;
	const sellingLenderAuthId =
		"sellingLenderAuthId" in deal && deal.sellingLenderAuthId
			? deal.sellingLenderAuthId
			: deal.sellerId;
	if (viewerAuthId === purchasingLenderAuthId) {
		return "purchasing_lender";
	}
	if (viewerAuthId === sellingLenderAuthId) {
		return "selling_lender";
	}
	return null;
}

function requestedPersonaMatches(
	requested: ParticipantWorkspacePersona,
	actual: Exclude<ParticipantWorkspacePersona, "participating_lender">
) {
	return requested === "participating_lender" || requested === actual;
}

function participantPersonaFromAccessRow(
	row: Doc<"dealAccess">,
	directPersona: Exclude<
		ParticipantWorkspacePersona,
		"participating_lender"
	> | null
) {
	if (row.persona === "purchasing_lender" || row.persona === "selling_lender") {
		return row.persona;
	}
	if (row.role === "lender") {
		return directPersona;
	}
	return null;
}

async function requireParticipantPersonaDealAccess(
	ctx: QueryCtx & { viewer: { authId: string; isFairLendAdmin: boolean } },
	args: {
		dealId: Id<"deals">;
		persona: ParticipantWorkspacePersona;
	}
) {
	if (ctx.viewer.isFairLendAdmin) {
		return;
	}
	const deal = await ctx.db.get(args.dealId);
	if (!deal) {
		throw new ConvexError(`Deal not found: ${String(args.dealId)}`);
	}
	const directPersona = canonicalLenderPersonaForViewer(
		deal,
		ctx.viewer.authId
	);
	const access = await ctx.db
		.query("dealAccess")
		.withIndex("by_user_and_deal", (query) =>
			query.eq("userId", ctx.viewer.authId).eq("dealId", args.dealId)
		)
		.collect();
	const hasRevokedDirectPersona = access.some((row) => {
		const rowPersona = participantPersonaFromAccessRow(row, directPersona);
		return (
			row.status !== "active" &&
			rowPersona !== null &&
			requestedPersonaMatches(args.persona, rowPersona)
		);
	});
	if (
		directPersona &&
		requestedPersonaMatches(args.persona, directPersona) &&
		!hasRevokedDirectPersona
	) {
		return;
	}
	for (const row of access) {
		if (row.status !== "active") {
			continue;
		}
		const rowPersona = participantPersonaFromAccessRow(row, directPersona);
		if (
			(rowPersona === "purchasing_lender" || rowPersona === "selling_lender") &&
			requestedPersonaMatches(args.persona, rowPersona)
		) {
			return;
		}
	}
	throw new ConvexError(
		`Forbidden: no ${args.persona} workspace access for ${String(args.dealId)}`
	);
}

function propertyLabel(property: PortalDealDetail["property"]) {
	if (!property) {
		return "Property unavailable";
	}
	return [property.streetAddress, property.city, property.province]
		.filter(Boolean)
		.join(", ");
}

function packageStatus(
	packageSurface: DealDocumentPackageSurface
): NonNullable<DealDocumentPackageSurface["package"]>["status"] | null {
	return packageSurface.package?.status ?? null;
}

function isPackageFailed(status: string | null) {
	return Boolean(status?.includes("failed"));
}

function isPackagePending(status: string | null) {
	return status === null || status === "pending" || status === "generating";
}

async function readParticipantSigningTask(
	ctx: QueryCtx & {
		viewer: { authId: string; email: string | undefined };
	},
	args: {
		dealId: Id<"deals">;
		packageSurface: DealDocumentPackageSurface;
	}
): Promise<
	ParticipantSigningTaskProjection & {
		recipients: ParticipantSigningRecipientProjection[];
	}
> {
	const packageState = packageStatus(args.packageSurface);
	if (isPackageFailed(packageState)) {
		return emptySigningTask("package_failed");
	}
	if (isPackagePending(packageState)) {
		return emptySigningTask("package_pending");
	}

	const [attempts, recipients, exceptions] = await Promise.all([
		ctx.db
			.query("dealEnvelopeAttempts")
			.withIndex("by_deal", (query) => query.eq("dealId", args.dealId))
			.collect(),
		ctx.db
			.query("dealEnvelopeRecipients")
			.withIndex("by_deal", (query) => query.eq("dealId", args.dealId))
			.collect(),
		ctx.db
			.query("dealSigningExceptions")
			.withIndex("by_deal", (query) => query.eq("dealId", args.dealId))
			.collect(),
	]);
	const activeAttempt =
		attempts
			.filter((attempt) => attempt.active)
			.sort((left, right) => right.createdAt - left.createdAt)[0] ??
		attempts.sort((left, right) => right.createdAt - left.createdAt)[0] ??
		null;
	if (!activeAttempt) {
		return emptySigningTask("not_started");
	}

	const attemptRecipients = recipients
		.filter((recipient) => recipient.attemptId === activeAttempt._id)
		.sort((left, right) => {
			if (left.signingOrder !== right.signingOrder) {
				return left.signingOrder - right.signingOrder;
			}
			return left.createdAt - right.createdAt;
		});
	const completion = summarizeRequiredRecipientCompletion(attemptRecipients);
	const openException = exceptions
		.filter(
			(exception) =>
				exception.attemptId === activeAttempt._id && exception.status === "open"
		)
		.sort((left, right) => right.createdAt - left.createdAt)[0];
	const projectedRecipients = attemptRecipients.map((recipient) => ({
		completedAt: recipient.completedAt ?? null,
		documensoRole: recipient.documensoRole,
		name: recipient.name,
		platformRole: recipient.platformRole,
		required: recipient.required,
		signingOrder: recipient.signingOrder,
		signingStatus: recipient.signingStatus,
	}));

	if (completion.isComplete || activeAttempt.status === "completed") {
		return {
			...baseSigningTask(activeAttempt, completion),
			recipients: projectedRecipients,
			status: "completed",
		};
	}
	if (openException) {
		return {
			...baseSigningTask(activeAttempt, completion),
			exceptionMessage: openException.message,
			recipients: projectedRecipients,
			status: "envelope_exception",
		};
	}
	if (
		activeAttempt.status === "configuration_error" ||
		activeAttempt.status === "send_failed" ||
		activeAttempt.status === "declined" ||
		activeAttempt.status === "voided" ||
		activeAttempt.status === "expired"
	) {
		return {
			...baseSigningTask(activeAttempt, completion),
			exceptionMessage:
				activeAttempt.terminalReason ??
				`Envelope status: ${activeAttempt.status}`,
			recipients: projectedRecipients,
			status: "envelope_exception",
		};
	}

	const viewerRecipient = attemptRecipients.find((recipient) =>
		recipientBelongsToViewer(recipient, ctx.viewer)
	);
	if (!viewerRecipient) {
		return {
			...baseSigningTask(activeAttempt, completion),
			recipients: projectedRecipients,
			status: "upcoming",
		};
	}
	if (viewerRecipient.signingStatus === "completed") {
		return {
			...baseSigningTask(activeAttempt, completion),
			recipientName: viewerRecipient.name,
			recipients: projectedRecipients,
			status: "completed",
		};
	}
	if (!isSigningOrderAvailable(attemptRecipients, viewerRecipient)) {
		return {
			...baseSigningTask(activeAttempt, completion),
			recipientName: viewerRecipient.name,
			recipients: projectedRecipients,
			status: "blocked",
		};
	}

	const now = Date.now();
	const canExposeToken = canExposeEmbeddedSigningToken({
		recipient: viewerRecipient,
		viewerAuthId: ctx.viewer.authId,
		viewerEmail: ctx.viewer.email,
		now,
	});
	if (
		viewerRecipient.tokenExpiresAt !== undefined &&
		viewerRecipient.tokenExpiresAt <= now
	) {
		return {
			...baseSigningTask(activeAttempt, completion),
			recipientName: viewerRecipient.name,
			recipients: projectedRecipients,
			status: "token_expired",
			tokenExpiresAt: viewerRecipient.tokenExpiresAt,
		};
	}
	if (canExposeToken && viewerRecipient.embeddedSigningToken) {
		return {
			...baseSigningTask(activeAttempt, completion),
			embeddedSigningToken: viewerRecipient.embeddedSigningToken,
			recipientName: viewerRecipient.name,
			recipients: projectedRecipients,
			status: "ready_to_sign",
			tokenExpiresAt: viewerRecipient.tokenExpiresAt ?? null,
		};
	}
	return {
		...baseSigningTask(activeAttempt, completion),
		recipientName: viewerRecipient.name,
		recipients: projectedRecipients,
		status: "token_unavailable",
		tokenExpiresAt: viewerRecipient.tokenExpiresAt ?? null,
	};
}

function recipientBelongsToViewer(
	recipient: {
		authId?: string;
		email: string;
	},
	viewer: { authId: string; email: string | undefined }
) {
	if (recipient.authId && recipient.authId === viewer.authId) {
		return true;
	}
	return Boolean(
		viewer.email &&
			recipient.email.trim().toLowerCase() === viewer.email.trim().toLowerCase()
	);
}

function emptySigningTask(
	status: ParticipantSigningStatus
): ParticipantSigningTaskProjection & {
	recipients: ParticipantSigningRecipientProjection[];
} {
	return {
		attemptId: null,
		completedRequiredCount: 0,
		embeddedSigningToken: null,
		exceptionMessage: null,
		providerDocumentId: null,
		providerEnvelopeId: null,
		recipientName: null,
		recipients: [],
		requiredCount: 0,
		status,
		tokenExpiresAt: null,
	};
}

function baseSigningTask(
	attempt: {
		_id: Id<"dealEnvelopeAttempts">;
		providerDocumentId?: string;
		providerEnvelopeId?: string;
	},
	completion: {
		completedRequiredCount: number;
		requiredCount: number;
	}
): ParticipantSigningTaskProjection {
	return {
		attemptId: attempt._id,
		completedRequiredCount: completion.completedRequiredCount,
		embeddedSigningToken: null,
		exceptionMessage: null,
		providerDocumentId: attempt.providerDocumentId ?? null,
		providerEnvelopeId: attempt.providerEnvelopeId ?? null,
		recipientName: null,
		requiredCount: completion.requiredCount,
		status: "not_started",
		tokenExpiresAt: null,
	};
}

function queueGroupForWorkspace(args: {
	closeReceipt: ParticipantCloseReceiptSummary;
	dealStatus: string;
	signingStatus: ParticipantSigningStatus;
}): ParticipantQueueGroupName {
	const hasReceiptEvidence = hasParticipantCloseReceiptEvidence(
		args.closeReceipt
	);
	if (hasReceiptEvidence && args.dealStatus === "confirmed") {
		return "completed";
	}
	if (
		args.signingStatus === "ready_to_sign" ||
		args.signingStatus === "token_expired" ||
		args.signingStatus === "token_unavailable" ||
		args.signingStatus === "envelope_exception" ||
		args.signingStatus === "package_failed"
	) {
		return "needsAction";
	}
	return "inProgress";
}

function nextActionForWorkspace(args: {
	persona: ParticipantWorkspacePersona;
	queueGroup: ParticipantQueueGroupName;
	signingStatus: ParticipantSigningStatus;
}) {
	const roleLabel =
		args.persona === "selling_lender" ? "selling lender" : "purchasing lender";
	if (args.queueGroup === "completed") {
		return "Review your closing receipt";
	}
	if (args.signingStatus === "ready_to_sign") {
		return `Sign your ${roleLabel} closing documents`;
	}
	if (args.signingStatus === "token_expired") {
		return "Request a refreshed signing link";
	}
	if (args.signingStatus === "token_unavailable") {
		return "Wait for the signing link to be issued";
	}
	if (args.signingStatus === "blocked") {
		return "Waiting for earlier recipients";
	}
	if (args.signingStatus === "envelope_exception") {
		return "Contact closing support about the signing exception";
	}
	if (args.signingStatus === "package_failed") {
		return "Closing package needs attention";
	}
	if (args.signingStatus === "package_pending") {
		return "Closing package is being prepared";
	}
	return "Review closing progress";
}

function blockersForWorkspace(args: {
	closeReceipt: ParticipantCloseReceiptSummary;
	dealStatus: string;
	packageState: string | null;
	signing: ParticipantSigningTaskProjection;
}): ParticipantWorkspaceBlocker[] {
	const blockers: ParticipantWorkspaceBlocker[] = [];
	if (isPackagePending(args.packageState)) {
		blockers.push({
			kind: "package_pending",
			message: "The closing package is still being prepared.",
		});
	}
	if (isPackageFailed(args.packageState)) {
		blockers.push({
			kind: "package_failed",
			message: "The closing package could not be prepared.",
		});
	}
	if (args.signing.status === "envelope_exception") {
		blockers.push({
			kind: "envelope_exception",
			message:
				args.signing.exceptionMessage ??
				"The signing envelope needs closing support.",
		});
	}
	if (args.signing.status === "token_expired") {
		blockers.push({
			kind: "token_expired",
			message: "The signing link has expired.",
		});
	}
	if (
		args.dealStatus === "confirmed" &&
		!hasParticipantCloseReceiptEvidence(args.closeReceipt)
	) {
		blockers.push({
			kind: "receipt_pending",
			message: "Close evidence is not ready for participant receipt display.",
		});
	}
	return blockers;
}

function timelineForWorkspace(args: {
	closeReceipt: ParticipantCloseReceiptSummary;
	dealCreatedAt: number;
	packageReadyAt: number | null;
	signing: ParticipantSigningTaskProjection;
}): ParticipantTimelineEntry[] {
	const signingTimelineStatus: ParticipantTimelineEntry["status"] =
		args.signing.status === "completed" ? "complete" : "current";
	const signingStatus =
		args.signing.status === "envelope_exception"
			? "blocked"
			: signingTimelineStatus;

	return [
		{
			at: args.dealCreatedAt,
			description: "The closing workspace was created.",
			label: "Deal opened",
			status: "complete",
		},
		{
			at: args.packageReadyAt,
			description: "Closing documents are prepared for review and signing.",
			label: "Package ready",
			status: args.packageReadyAt ? "complete" : "current",
		},
		{
			at: null,
			description: "Required recipients complete the signing sequence.",
			label: "Signatures",
			status: signingStatus,
		},
		{
			at: args.closeReceipt.closedAt,
			description: "Participant-safe funds and archive evidence is available.",
			label: "Closed",
			status: args.closeReceipt.closedAt ? "complete" : "upcoming",
		},
	];
}

// ── Internal: used by effects ──────────────────────────────────────

/**
 * Internal query to fetch a deal by ID.
 * Used by effects that need to read deal data without auth checks.
 */
export const getInternalDeal = internalQuery({
	args: { dealId: v.id("deals") },
	handler: async (ctx, { dealId }) => {
		const deal = await ctx.db.get(dealId);
		if (!deal) {
			throw new ConvexError("DEAL_NOT_FOUND");
		}
		return deal;
	},
});

/**
 * Internal mutation to set or clear the reservationId on a deal.
 * Called by the reserveShares effect after successfully creating a reservation.
 * Pass undefined for reservationId to clear it.
 */
export const setReservationId = internalMutation({
	args: {
		dealId: v.id("deals"),
		reservationId: v.optional(v.id("ledger_reservations")),
	},
	handler: async (ctx, { dealId, reservationId }) => {
		const deal = await ctx.db.get(dealId);
		if (!deal) {
			throw new ConvexError("DEAL_NOT_FOUND");
		}
		await ctx.db.patch(dealId, { reservationId });
	},
});

export const getActiveDealAccess = internalQuery({
	args: { dealId: v.id("deals") },
	handler: async (ctx, { dealId }) => {
		return await ctx.db
			.query("dealAccess")
			.withIndex("by_deal", (q) => q.eq("dealId", dealId))
			.filter((q) => q.eq(q.field("status"), "active"))
			.collect();
	},
});

export const getActiveLawyerAccess = internalQuery({
	args: { dealId: v.id("deals") },
	handler: async (ctx, { dealId }) => {
		const allActive = await ctx.db
			.query("dealAccess")
			.withIndex("by_deal", (q) => q.eq("dealId", dealId))
			.filter((q) => q.eq(q.field("status"), "active"))
			.collect();
		return allActive.filter(
			(r) => r.role === "platform_lawyer" || r.role === "guest_lawyer"
		);
	},
});

// ── Public: activeDealAccessRecords ──────────────────────────────────

/**
 * Returns all active dealAccess records for a deal.
 * Enforces two-layer authorization: admin bypass → dealAccess check.
 */
export const activeDealAccessRecords = authedQuery
	.input({ dealId: v.id("deals") })
	.handler(async (ctx, { dealId }) => {
		await assertDealAccess(ctx, dealId);

		return await ctx.db
			.query("dealAccess")
			.withIndex("by_deal", (q) => q.eq("dealId", dealId))
			.filter((q) => q.eq(q.field("status"), "active"))
			.collect();
	})
	.public();

// ── Public: getDealsByPhase ───────────────────────────────────────────

/**
 * Returns deals grouped by phase for Kanban board display.
 * Groups deals into 6 columns: initiated, lawyerOnboarding, documentReview,
 * fundsTransfer, confirmed, failed
 */
export const getDealsByPhase = adminQuery
	.handler(async (ctx): Promise<DealsByPhase> => {
		const allDeals = await ctx.db.query("deals").collect();

		const result: DealsByPhase = {
			initiated: [],
			lawyerOnboarding: [],
			documentReview: [],
			fundsTransfer: [],
			confirmed: [],
			failed: [],
			unknown: [],
		};

		for (const deal of allDeals) {
			const phase = getDealPhase(deal.status);
			const dealWithPhase: DealWithPhase = {
				_id: deal._id,
				status: deal.status,
				mortgageId: deal.mortgageId,
				buyerId: deal.buyerId,
				sellerId: deal.sellerId,
				fractionalShare: deal.fractionalShare,
				fractionalShareDisplayPercent: projectFractionalShareUnits(
					deal.fractionalShare
				).fractionalShareDisplayPercent,
				fractionalShareUnits: deal.fractionalShare,
				closingDate: deal.closingDate,
				lawyerId: deal.lawyerId,
				lawyerType: deal.lawyerType,
				createdAt: deal.createdAt,
				createdBy: deal.createdBy,
			};
			result[phase].push(dealWithPhase);
		}

		return result;
	})
	.public();

// ── Public: closingTeamAssignments ──────────────────────────────────────

/**
 * Returns closing team assignments for deals.
 * Links to deals via mortgageId field.
 */
export const closingTeamAssignments = adminQuery
	.handler(async (ctx) => {
		return await ctx.db.query("closingTeamAssignments").collect();
	})
	.public();

export const getAdminDealOperations = adminQuery
	.handler(async (ctx): Promise<AdminDealOperationsProjection> => {
		const viewerUser = await ctx.db
			.query("users")
			.withIndex("authId", (query) => query.eq("authId", ctx.viewer.authId))
			.unique();
		const deals = await ctx.db.query("deals").collect();
		const cards = (
			await Promise.all(
				deals.map((deal) =>
					buildAdminDealOperationsCard(ctx, deal, viewerUser?._id)
				)
			)
		)
			.filter((card): card is AdminDealOperationsCard => card !== null)
			.sort((left, right) => {
				const leftDate = left.closingDate ?? Number.MAX_SAFE_INTEGER;
				const rightDate = right.closingDate ?? Number.MAX_SAFE_INTEGER;
				if (leftDate !== rightDate) {
					return leftDate - rightDate;
				}
				return right.createdAt - left.createdAt;
			});

		const columns: DealsByPhase = {
			initiated: [],
			lawyerOnboarding: [],
			documentReview: [],
			fundsTransfer: [],
			confirmed: [],
			failed: [],
			unknown: [],
		};
		const filters: Record<AdminDealOperationsFilter, number> = {
			all: 0,
			needs_action: 0,
			blocked: 0,
			awaiting_signatures: 0,
			awaiting_funds: 0,
			completed: 0,
			failed: 0,
		};

		for (const card of cards) {
			columns[card.lifecycle.phase].push({
				_id: card._id,
				status: card.lifecycle.status,
				mortgageId: card.mortgageId,
				buyerId: card.participants.buyer.authId,
				sellerId: card.participants.seller.authId,
				fractionalShare: card.fractionalShareUnits,
				fractionalShareDisplayPercent: card.fractionalShareDisplayPercent,
				fractionalShareUnits: card.fractionalShareUnits,
				closingDate: card.closingDate ?? undefined,
				lawyerId: card.participants.lawyer.authId ?? undefined,
				lawyerType: card.participants.lawyer.lawyerType ?? undefined,
				createdAt: card.createdAt,
				createdBy: card.createdBy,
			});
			for (const filter of card.filters) {
				filters[filter] += 1;
			}
		}

		return { cards, columns, filters };
	})
	.public();

export const getAdminDealOperationsDetail = adminQuery
	.input({ dealId: v.id("deals") })
	.handler(async (ctx, args): Promise<AdminDealOperationsDetail | null> => {
		const viewerUser = await ctx.db
			.query("users")
			.withIndex("authId", (query) => query.eq("authId", ctx.viewer.authId))
			.unique();
		const deal = await ctx.db.get(args.dealId);
		if (!deal) {
			return null;
		}
		return buildAdminDealOperationsDetail(ctx, deal, viewerUser?._id);
	})
	.public();

export const getPortalDealDetail = dealQuery
	.input({
		dealId: v.id("deals"),
	})
	.handler(async (ctx, args): Promise<PortalDealDetail | null> => {
		await assertDealAccess(ctx, args.dealId);

		const deal = await ctx.db.get(args.dealId);
		if (!deal) {
			return null;
		}

		const mortgage = await ctx.db.get(deal.mortgageId);
		if (!mortgage) {
			return null;
		}

		const [property, participants, viewerUser, closeEvidence] =
			await Promise.all([
				ctx.db.get(mortgage.propertyId),
				buildDealParticipantProjection(ctx, deal),
				ctx.db
					.query("users")
					.withIndex("authId", (query) => query.eq("authId", ctx.viewer.authId))
					.unique(),
				readCloseEvidenceProjection(ctx, args.dealId),
			]);

		const packageSurfaceWithViewer = await readDealDocumentPackageSurface(
			ctx,
			args.dealId,
			{
				isFairLendAdmin: ctx.viewer.isFairLendAdmin,
				userId: viewerUser?._id,
			}
		);
		return {
			closeReceipt: toParticipantCloseReceipt(deal, closeEvidence),
			deal: {
				closingDate: deal.closingDate ?? null,
				dealId: deal._id,
				fractionalShare: deal.fractionalShare,
				fractionalShareDisplayPercent:
					participants.fractionalShareDisplayPercent,
				fractionalShareUnits: participants.fractionalShareUnits,
				lockingFeeAmount: deal.lockingFeeAmount ?? null,
				status: deal.status,
			},
			mortgage: {
				interestRate: mortgage.interestRate,
				maturityDate: mortgage.maturityDate,
				mortgageId: mortgage._id,
				paymentAmount: mortgage.paymentAmount,
				paymentFrequency: mortgage.paymentFrequency,
				principal: mortgage.principal,
				status: mortgage.status,
			},
			property: property
				? {
						city: property.city,
						propertyType: property.propertyType,
						province: property.province,
						streetAddress: property.streetAddress,
						unit: property.unit ?? null,
					}
				: null,
			parties: {
				lender: {
					email: participants.buyer.email,
					name: participants.buyer.displayName,
				},
				seller: {
					email: participants.seller.email,
					name: participants.seller.displayName,
				},
			},
			documentInstances: packageSurfaceWithViewer.instances
				.filter(
					(instance) =>
						instance.class === "private_static" ||
						instance.class === "private_templated_non_signable" ||
						instance.class === "private_templated_signable"
				)
				.map(projectPortalDealDocumentInstance),
			participants,
			documentPackage: packageSurfaceWithViewer.package
				? {
						archivedAt: packageSurfaceWithViewer.package.archivedAt,
						lastError: packageSurfaceWithViewer.package.lastError,
						readyAt: packageSurfaceWithViewer.package.readyAt,
						retryCount: packageSurfaceWithViewer.package.retryCount,
						status: packageSurfaceWithViewer.package.status,
					}
				: null,
		};
	})
	.public();

async function buildParticipantDealWorkspace(
	ctx: QueryCtx & {
		viewer: {
			authId: string;
			email: string | undefined;
			isFairLendAdmin: boolean;
		};
	},
	args: {
		deal: Doc<"deals">;
		persona: ParticipantWorkspacePersona;
	}
): Promise<ParticipantDealWorkspace | null> {
	const deal = args.deal;
	const mortgage = await ctx.db.get(deal.mortgageId);
	if (!mortgage) {
		return null;
	}

	const [
		property,
		participants,
		viewerUser,
		closeEvidence,
		legalRepresentation,
	] = await Promise.all([
		ctx.db.get(mortgage.propertyId),
		buildDealParticipantProjection(ctx, deal),
		ctx.db
			.query("users")
			.withIndex("authId", (query) => query.eq("authId", ctx.viewer.authId))
			.unique(),
		readCloseEvidenceProjection(ctx, deal._id),
		buildLegalRepresentationStatusProjection(ctx, { deal }),
	]);
	const packageSurface = await readDealDocumentPackageSurface(ctx, deal._id, {
		isFairLendAdmin: ctx.viewer.isFairLendAdmin,
		userId: viewerUser?._id,
	});
	const signing = await readParticipantSigningTask(ctx, {
		dealId: deal._id,
		packageSurface,
	});
	const closeReceipt = toParticipantCloseReceipt(deal, closeEvidence);
	const queueGroup = queueGroupForWorkspace({
		closeReceipt,
		dealStatus: deal.status,
		signingStatus: signing.status,
	});
	const nextAction = nextActionForWorkspace({
		persona: args.persona,
		queueGroup,
		signingStatus: signing.status,
	});
	const projectedDocuments = packageSurface.instances
		.filter(
			(instance) =>
				instance.class === "private_static" ||
				instance.class === "private_templated_non_signable" ||
				instance.class === "private_templated_signable"
		)
		.map(projectPortalDealDocumentInstance);
	const documentPackage = packageSurface.package
		? {
				archivedAt: packageSurface.package.archivedAt,
				lastError: packageSurface.package.lastError,
				readyAt: packageSurface.package.readyAt,
				retryCount: packageSurface.package.retryCount,
				status: packageSurface.package.status,
			}
		: null;
	const workspace: ParticipantDealWorkspace = {
		blockers: blockersForWorkspace({
			closeReceipt,
			dealStatus: deal.status,
			packageState: packageStatus(packageSurface),
			signing,
		}),
		closeReceipt,
		deal: {
			closingDate: deal.closingDate ?? null,
			dealId: deal._id,
			fractionalShare: deal.fractionalShare,
			fractionalShareDisplayPercent: participants.fractionalShareDisplayPercent,
			fractionalShareUnits: participants.fractionalShareUnits,
			lockingFeeAmount: deal.lockingFeeAmount ?? null,
			persona: args.persona,
			status: deal.status,
		},
		documentInstances: projectedDocuments,
		documentPackage,
		legalRepresentation,
		mortgage: {
			interestRate: mortgage.interestRate,
			maturityDate: mortgage.maturityDate,
			mortgageId: mortgage._id,
			paymentAmount: mortgage.paymentAmount,
			paymentFrequency: mortgage.paymentFrequency,
			principal: mortgage.principal,
			status: mortgage.status,
		},
		nextAction,
		participants,
		parties: {
			assignedLawyer: {
				email: participants.lawyer.email,
				name: participants.lawyer.displayName,
			},
			lender: {
				email: participants.buyer.email,
				name: participants.buyer.displayName,
			},
			seller: {
				email: participants.seller.email,
				name: participants.seller.displayName,
			},
		},
		persona: args.persona,
		property: property
			? {
					city: property.city,
					propertyType: property.propertyType,
					province: property.province,
					streetAddress: property.streetAddress,
					unit: property.unit ?? null,
				}
			: null,
		queueGroup,
		signing,
		timeline: timelineForWorkspace({
			closeReceipt,
			dealCreatedAt: deal.createdAt,
			packageReadyAt: documentPackage?.readyAt ?? null,
			signing,
		}),
	};
	return workspace;
}

const participantWorkspaceInput = {
	persona: v.union(
		v.literal("purchasing_lender"),
		v.literal("selling_lender"),
		v.literal("participating_lender")
	),
};

export const getParticipantDealQueue = authedQuery
	.input(participantWorkspaceInput)
	.handler(async (ctx, args): Promise<ParticipantDealQueue> => {
		const deals = ctx.viewer.isFairLendAdmin
			? await ctx.db.query("deals").collect()
			: await readParticipantPersonaDeals(ctx, args.persona);
		const queue: ParticipantDealQueue = {
			completed: [],
			inProgress: [],
			needsAction: [],
			persona: args.persona,
		};

		for (const deal of deals) {
			let workspacePersona: Exclude<
				ParticipantWorkspacePersona,
				"participating_lender"
			> | null;
			if (args.persona === "participating_lender") {
				workspacePersona = ctx.viewer.isFairLendAdmin
					? "purchasing_lender"
					: canonicalLenderPersonaForViewer(deal, ctx.viewer.authId);
			} else {
				workspacePersona = args.persona;
			}
			if (!workspacePersona) {
				continue;
			}
			const workspace = await buildParticipantDealWorkspace(ctx, {
				deal,
				persona: workspacePersona,
			});
			if (!workspace) {
				continue;
			}
			queue[workspace.queueGroup].push({
				closingDate: workspace.deal.closingDate,
				dealId: workspace.deal.dealId,
				group: workspace.queueGroup,
				nextAction: workspace.nextAction,
				persona: workspacePersona,
				propertyLabel: propertyLabel(workspace.property),
				signingStatus: workspace.signing.status,
				status: workspace.deal.status,
			});
		}

		for (const group of [
			queue.needsAction,
			queue.inProgress,
			queue.completed,
		]) {
			group.sort((left, right) => {
				const leftDate = left.closingDate ?? Number.MAX_SAFE_INTEGER;
				const rightDate = right.closingDate ?? Number.MAX_SAFE_INTEGER;
				if (leftDate !== rightDate) {
					return leftDate - rightDate;
				}
				return String(left.dealId).localeCompare(String(right.dealId));
			});
		}

		return queue;
	})
	.public();

export const getParticipantDealWorkspace = authedQuery
	.input({
		dealId: v.id("deals"),
		...participantWorkspaceInput,
	})
	.handler(async (ctx, args): Promise<ParticipantDealWorkspace | null> => {
		await assertDealAccess(ctx, args.dealId);
		await requireParticipantPersonaDealAccess(ctx, {
			dealId: args.dealId,
			persona: args.persona,
		});
		const deal = await ctx.db.get(args.dealId);
		if (!deal) {
			return null;
		}
		return buildParticipantDealWorkspace(ctx, {
			deal,
			persona: args.persona,
		});
	})
	.public();

async function readParticipantPersonaDeals(
	ctx: QueryCtx & { viewer: { authId: string } },
	persona: ParticipantWorkspacePersona
) {
	const accessRows = await ctx.db
		.query("dealAccess")
		.withIndex("by_user", (query) => query.eq("userId", ctx.viewer.authId))
		.collect();
	const directDealReads: Promise<Doc<"deals">[]>[] = [];
	if (persona === "purchasing_lender" || persona === "participating_lender") {
		directDealReads.push(
			ctx.db
				.query("deals")
				.withIndex("by_buyer", (query) =>
					query.eq("buyerId", ctx.viewer.authId)
				)
				.collect()
		);
	}
	if (persona === "selling_lender" || persona === "participating_lender") {
		directDealReads.push(
			ctx.db
				.query("deals")
				.withIndex("by_seller", (query) =>
					query.eq("sellerId", ctx.viewer.authId)
				)
				.collect()
		);
	}
	const directlyAddressedDeals = (await Promise.all(directDealReads)).flat();
	const accessDealIds = [
		...new Set(
			accessRows
				.filter((row) => {
					if (row.status !== "active") {
						return false;
					}
					if (row.persona === undefined) {
						return row.role === "lender";
					}
					return (
						(row.persona === "purchasing_lender" ||
							row.persona === "selling_lender") &&
						requestedPersonaMatches(persona, row.persona)
					);
				})
				.map((row) => row.dealId)
		),
	];
	const accessDeals = await Promise.all(
		accessDealIds.map((dealId) => ctx.db.get(dealId))
	);
	const combined = [
		...directlyAddressedDeals,
		...accessDeals.filter(
			(deal): deal is NonNullable<typeof deal> => deal !== null
		),
	].filter((deal) => {
		const directPersona = canonicalLenderPersonaForViewer(
			deal,
			ctx.viewer.authId
		);
		const hasRevokedDirectPersona = accessRows.some((row) => {
			if (row.dealId !== deal._id) {
				return false;
			}
			const rowPersona = participantPersonaFromAccessRow(row, directPersona);
			return (
				row.status !== "active" &&
				rowPersona !== null &&
				requestedPersonaMatches(persona, rowPersona)
			);
		});
		if (hasRevokedDirectPersona) {
			return false;
		}
		if (persona === "participating_lender") {
			return true;
		}
		return directPersona === persona;
	});
	return [...new Map(combined.map((deal) => [deal._id, deal])).values()];
}

export const getAdminCloseEvidence = adminQuery
	.input({ dealId: v.id("deals") })
	.handler(async (ctx, args): Promise<AdminCloseEvidenceProjection | null> => {
		const deal = await ctx.db.get(args.dealId);
		if (!deal) {
			return null;
		}
		return readCloseEvidenceProjection(ctx, args.dealId);
	})
	.public();

export const getParticipantCloseReceipt = dealQuery
	.input({ dealId: v.id("deals") })
	.handler(
		async (ctx, args): Promise<ParticipantCloseReceiptSummary | null> => {
			await assertDealAccess(ctx, args.dealId);
			const deal = await ctx.db.get(args.dealId);
			if (!deal) {
				return null;
			}
			const closeEvidence = await readCloseEvidenceProjection(ctx, args.dealId);
			return toParticipantCloseReceipt(deal, closeEvidence);
		}
	)
	.public();
