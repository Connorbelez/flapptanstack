import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { readDealDocumentPackageSurface } from "../documents/dealPackages";
import { lawyerQuery, type Viewer } from "../fluent";
import { buildDealParticipantProjection } from "./participantProjection";

type LawyerQueryCtx = Pick<QueryCtx, "db"> & { viewer: Viewer };
type PackageSurface = Awaited<
	ReturnType<typeof readDealDocumentPackageSurface>
>;
type PackageSurfaceInstance = PackageSurface["instances"][number];
type ParticipantProjection = Awaited<
	ReturnType<typeof buildDealParticipantProjection>
>;

type LawyerAccessState = "active" | "completed_read_only";
type LawyerMatterQueueBucket =
	| "needsRepresentationConfirmation"
	| "needsPackageReview"
	| "awaitingSigners"
	| "completed";

interface LawyerAccessPolicy {
	accessRole: "platform_lawyer" | "guest_lawyer" | null;
	accessState: LawyerAccessState;
}

interface LawyerAssignedClosing {
	accessRole: LawyerAccessPolicy["accessRole"];
	accessState: LawyerAccessState;
	bucket: LawyerMatterQueueBucket;
	closingDate: number | null;
	dealId: Id<"deals">;
	fractionalShareDisplayPercent: number | null;
	fractionalShareUnits: number;
	lawyer: ParticipantProjection["lawyer"];
	matterName: string;
	participants: ParticipantProjection;
	status: string;
}

function isLawyerAccessRole(role: Doc<"dealAccess">["role"]) {
	return role === "platform_lawyer" || role === "guest_lawyer";
}

function isCompletedDealStatus(status: string) {
	return status === "confirmed";
}

function queueBucketForDeal(status: string): LawyerMatterQueueBucket {
	if (isCompletedDealStatus(status)) {
		return "completed";
	}
	if (status === "lawyerOnboarding.verified") {
		return "needsRepresentationConfirmation";
	}
	if (status === "documentReview.pending") {
		return "needsPackageReview";
	}
	return "awaitingSigners";
}

function packageApprovalStatus(
	packageSurface: PackageSurface,
	openExceptions: readonly Pick<
		Doc<"dealSigningExceptions">,
		"kind" | "status"
	>[]
) {
	const blockers: string[] = [];
	const signableInstances = packageSurface.instances.filter(
		(instance) => instance.class === "private_templated_signable"
	);

	if (packageSurface.package?.status !== "ready") {
		blockers.push("Generated package is not ready.");
	}
	if (signableInstances.length === 0) {
		blockers.push("No signable package documents are available.");
	}
	if (
		signableInstances.some(
			(instance) =>
				instance.status === "signature_pending_recipient_resolution" ||
				instance.signingState?.status === "pending_recipient_resolution"
		)
	) {
		blockers.push("Signatory mappings are incomplete.");
	}
	if (
		openExceptions.some(
			(exception) =>
				exception.status === "open" &&
				exception.kind === "pre_send_configuration_failure"
		)
	) {
		blockers.push("Open pre-send configuration exceptions must be resolved.");
	}

	return {
		eligible: blockers.length === 0,
		blockers,
	};
}

async function lawyerAccessPolicyForDeal(
	ctx: LawyerQueryCtx,
	deal: Doc<"deals">
): Promise<LawyerAccessPolicy | null> {
	const rows = await ctx.db
		.query("dealAccess")
		.withIndex("by_user_and_deal", (query) =>
			query.eq("userId", ctx.viewer.authId).eq("dealId", deal._id)
		)
		.collect();
	const activeLawyerAccess = rows.find(
		(row) => row.status === "active" && isLawyerAccessRole(row.role)
	);
	if (activeLawyerAccess) {
		return {
			accessRole: activeLawyerAccess.role as "platform_lawyer" | "guest_lawyer",
			accessState: "active",
		};
	}

	const assignedPlatformLawyer =
		deal.lawyerId === ctx.viewer.authId &&
		deal.lawyerType === "platform_lawyer";
	if (assignedPlatformLawyer && !isCompletedDealStatus(deal.status)) {
		return {
			accessRole: "platform_lawyer",
			accessState: "active",
		};
	}

	const historicalLawyerAccess = rows.find(
		(row) => row.status === "revoked" && isLawyerAccessRole(row.role)
	);
	if (
		isCompletedDealStatus(deal.status) &&
		(historicalLawyerAccess || assignedPlatformLawyer)
	) {
		return {
			accessRole:
				(historicalLawyerAccess?.role as "platform_lawyer" | "guest_lawyer") ??
				"platform_lawyer",
			accessState: "completed_read_only",
		};
	}

	return null;
}

async function requireLawyerAccessPolicyForDeal(
	ctx: LawyerQueryCtx,
	deal: Doc<"deals">
) {
	const policy = await lawyerAccessPolicyForDeal(ctx, deal);
	if (!policy) {
		throw new ConvexError(
			`Forbidden: no lawyer access for ${String(deal._id)}`
		);
	}
	return policy;
}

async function envelopeProjection(ctx: LawyerQueryCtx, dealId: Id<"deals">) {
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

	return {
		attempts: attempts
			.sort((left, right) => left.createdAt - right.createdAt)
			.map((attempt) => ({
				...attempt,
				exceptions: exceptions.filter(
					(exception) => exception.attemptId === attempt._id
				),
				recipients: recipients
					.filter((recipient) => recipient.attemptId === attempt._id)
					.sort((left, right) => {
						if (left.signingOrder !== right.signingOrder) {
							return left.signingOrder - right.signingOrder;
						}
						return left.createdAt - right.createdAt;
					})
					.map((recipient) => ({
						_id: recipient._id,
						authId: recipient.authId,
						completedAt: recipient.completedAt,
						createdAt: recipient.createdAt,
						dealDocumentInstanceId: recipient.dealDocumentInstanceId,
						dealId: recipient.dealId,
						documensoRole: recipient.documensoRole,
						email: recipient.email,
						name: recipient.name,
						packageId: recipient.packageId,
						platformRole: recipient.platformRole,
						providerRecipientId: recipient.providerRecipientId,
						readStatus: recipient.readStatus,
						rejectionReason: recipient.rejectionReason,
						required: recipient.required,
						sendStatus: recipient.sendStatus,
						sentAt: recipient.sentAt,
						signingOrder: recipient.signingOrder,
						signingStatus: recipient.signingStatus,
						tokenAvailable:
							recipient.tokenAvailableAt !== undefined &&
							(recipient.tokenExpiresAt === undefined ||
								recipient.tokenExpiresAt > Date.now()),
						tokenAvailableAt: recipient.tokenAvailableAt,
						tokenExpiresAt: recipient.tokenExpiresAt,
						updatedAt: recipient.updatedAt,
					})),
			})),
		exceptions,
	};
}

function projectDocumentInstance(instance: PackageSurfaceInstance) {
	return {
		class: instance.class,
		displayName: instance.displayName,
		instanceId: instance.instanceId,
		kind: instance.kind,
		packageLabel: instance.packageLabel,
		signingState: instance.signingState,
		status: instance.status,
		url:
			instance.status === "available" &&
			(instance.class === "private_static" ||
				instance.class === "private_templated_non_signable")
				? instance.url
				: null,
	};
}

async function legalTimeline(ctx: LawyerQueryCtx, dealId: Id<"deals">) {
	return ctx.db
		.query("auditJournal")
		.withIndex("by_entity", (query) =>
			query.eq("entityType", "deal").eq("entityId", String(dealId))
		)
		.collect();
}

function closeMilestonesForDeal(
	deal: Doc<"deals">,
	timelineEntries: readonly Doc<"auditJournal">[]
) {
	if (!isCompletedDealStatus(deal.status)) {
		return [];
	}

	const closeEntry = [...timelineEntries]
		.filter(
			(entry) =>
				entry.newState === "confirmed" ||
				entry.eventType === "CLOSE_CONFIRMED" ||
				entry.eventType === "CLOSING_CONFIRMED"
		)
		.sort((left, right) => right.timestamp - left.timestamp)[0];

	return [
		{
			at: closeEntry?.timestamp ?? deal.closingDate ?? deal.createdAt,
			description: closeEntry?.reason ?? "Deal close confirmed.",
			title: "Close complete",
		},
	];
}

export const listAssignedClosings = lawyerQuery
	.handler(async (ctx) => {
		const deals = await ctx.db.query("deals").collect();
		const assigned: LawyerAssignedClosing[] = [];

		for (const deal of deals) {
			const accessPolicy = await lawyerAccessPolicyForDeal(ctx, deal);
			if (!accessPolicy) {
				continue;
			}
			const participants = await buildDealParticipantProjection(ctx, deal);
			assigned.push({
				accessRole: accessPolicy.accessRole,
				accessState: accessPolicy.accessState,
				bucket: queueBucketForDeal(deal.status),
				closingDate: deal.closingDate ?? null,
				dealId: deal._id,
				fractionalShareDisplayPercent:
					participants.fractionalShareDisplayPercent,
				fractionalShareUnits: participants.fractionalShareUnits,
				lawyer: participants.lawyer,
				matterName: `${participants.buyer.displayName} / ${participants.seller.displayName}`,
				participants,
				status: deal.status,
			});
		}

		return assigned.sort((left, right) => {
			if (left.bucket !== right.bucket) {
				return left.bucket.localeCompare(right.bucket);
			}
			return (left.closingDate ?? 0) - (right.closingDate ?? 0);
		});
	})
	.public();

export const getLawyerDealWorkspace = lawyerQuery
	.input({ dealId: v.id("deals") })
	.handler(async (ctx, args) => {
		const deal = await ctx.db.get(args.dealId);
		if (!deal) {
			return null;
		}

		const accessPolicy = await requireLawyerAccessPolicyForDeal(ctx, deal);
		const mortgage = await ctx.db.get(deal.mortgageId);
		if (!mortgage) {
			return null;
		}

		const [property, participants, packageSurface, envelope, timelineEntries] =
			await Promise.all([
				ctx.db.get(mortgage.propertyId),
				buildDealParticipantProjection(ctx, deal),
				readDealDocumentPackageSurface(ctx, deal._id),
				envelopeProjection(ctx, deal._id),
				legalTimeline(ctx, deal._id),
			]);
		const openExceptions = envelope.exceptions.filter(
			(exception) => exception.status === "open"
		);

		return {
			access: accessPolicy,
			deal: {
				closingDate: deal.closingDate ?? null,
				dealId: deal._id,
				fractionalShareDisplayPercent:
					participants.fractionalShareDisplayPercent,
				fractionalShareUnits: participants.fractionalShareUnits,
				status: deal.status,
			},
			envelope,
			matterOverview: {
				mortgage: {
					interestRate: mortgage.interestRate,
					maturityDate: mortgage.maturityDate,
					mortgageId: mortgage._id,
					paymentAmount: mortgage.paymentAmount,
					paymentFrequency: mortgage.paymentFrequency,
					principal: mortgage.principal,
					status: mortgage.status,
				},
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
			},
			packageReview: {
				approval: packageApprovalStatus(packageSurface, openExceptions),
				instances: packageSurface.instances.map(projectDocumentInstance),
				package: packageSurface.package
					? {
							readyAt: packageSurface.package.readyAt,
							status: packageSurface.package.status,
						}
					: null,
			},
			readOnly: accessPolicy.accessState !== "active",
			timeline: {
				closeMilestones: closeMilestonesForDeal(deal, timelineEntries),
				legalActions: timelineEntries.map((entry) => ({
					at: entry.timestamp,
					description:
						entry.reason ??
						`${entry.eventType} ${entry.outcome} from ${entry.previousState} to ${entry.newState}`,
					eventType: entry.eventType,
					outcome: entry.outcome,
					title: entry.eventType,
				})),
			},
		};
	})
	.public();
