import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
	internalMutation,
	internalQuery,
	type QueryCtx,
} from "../_generated/server";
import { assertDealAccess } from "../authz/resourceAccess";
import { readDealDocumentPackageSurface } from "../documents/dealPackages";
import { adminQuery, authedQuery, dealQuery } from "../fluent";
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
	| "failed";

function getDealPhase(status: string): DealPhase {
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
	// Default to initiated for unknown statuses
	// Log unknown statuses for observability (shouldn't happen in production)
	console.warn(
		`Unknown deal status encountered: ${status}, defaulting to initiated`
	);
	return "initiated";
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

export type ParticipantWorkspacePersona = "buyer" | "seller";
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

function hasParticipantCloseReceiptEvidence(
	closeReceipt: ParticipantCloseReceiptSummary
) {
	return Boolean(
		closeReceipt.closedAt ||
			closeReceipt.funds ||
			closeReceipt.signedArchiveStatus === "archived"
	);
}

function roleForPersona(persona: ParticipantWorkspacePersona) {
	return persona === "buyer" ? "lender" : "borrower";
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
	const role = roleForPersona(args.persona);
	const access = await ctx.db
		.query("dealAccess")
		.withIndex("by_user_and_deal", (query) =>
			query.eq("userId", ctx.viewer.authId).eq("dealId", args.dealId)
		)
		.collect();
	if (access.some((row) => row.status === "active" && row.role === role)) {
		return;
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
	const roleLabel = args.persona === "buyer" ? "buyer" : "seller";
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

	const [property, participants, packageSurface, closeEvidence] =
		await Promise.all([
			ctx.db.get(mortgage.propertyId),
			buildDealParticipantProjection(ctx, deal),
			readDealDocumentPackageSurface(ctx, deal._id),
			readCloseEvidenceProjection(ctx, deal._id),
		]);
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
	persona: v.union(v.literal("buyer"), v.literal("seller")),
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
			const workspace = await buildParticipantDealWorkspace(ctx, {
				deal,
				persona: args.persona,
			});
			if (!workspace) {
				continue;
			}
			queue[workspace.queueGroup].push({
				closingDate: workspace.deal.closingDate,
				dealId: workspace.deal.dealId,
				group: workspace.queueGroup,
				nextAction: workspace.nextAction,
				persona: args.persona,
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
	const role = roleForPersona(persona);
	const accessRows = await ctx.db
		.query("dealAccess")
		.withIndex("by_user", (query) => query.eq("userId", ctx.viewer.authId))
		.collect();
	const dealIds = [
		...new Set(
			accessRows
				.filter((row) => row.status === "active" && row.role === role)
				.map((row) => row.dealId)
		),
	];
	const deals = await Promise.all(dealIds.map((dealId) => ctx.db.get(dealId)));
	return deals.filter(
		(deal): deal is NonNullable<typeof deal> => deal !== null
	);
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
