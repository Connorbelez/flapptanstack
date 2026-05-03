import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { ActionCtx } from "../../_generated/server";
import {
	getWorkosProvisioning,
	type WorkosOrganizationMembership,
	type WorkosProvisioning,
} from "../../engine/effects/workosProvisioning";
import { adminAction, adminQuery } from "../../fluent";
import {
	buildBrokerReassignmentPartySummary,
	isFairLendOwnedBroker,
} from "./reassignmentResolution";
import type {
	BrokerReassignmentPartySummary,
	BrokerReassignmentPreview,
} from "./reassignmentTypes";

interface ReassignmentActionContext {
	currentBroker: Doc<"brokers">;
	lender: Doc<"lenders">;
	lenderUser: Doc<"users">;
	targetBroker: Doc<"brokers">;
}

interface ReassignmentContextArgs extends Record<string, unknown> {
	expectedCurrentBrokerId: Id<"brokers">;
	expectedCurrentOrgId?: string;
	lenderId: Id<"lenders">;
	targetBrokerId: Id<"brokers">;
}

interface MarkReassignmentStartedArgs extends Record<string, unknown> {
	adminAuthId: string;
	currentBrokerId: Id<"brokers">;
	currentOrgId?: string;
	currentPortalHost?: string;
	currentPortalId?: Id<"portals">;
	lenderId: Id<"lenders">;
	lenderUserId: Id<"users">;
	targetBrokerId: Id<"brokers">;
	targetOrgId: string;
	targetPortalHost?: string;
	targetPortalId?: Id<"portals">;
}

interface CompleteReassignmentArgs extends Record<string, unknown> {
	attemptId: Id<"lenderBrokerReassignmentAttempts">;
	currentMembershipId?: string;
	currentMembershipOperation?: CurrentMembershipOperation;
	currentMembershipRoleSlugsAfter?: string[];
	currentMembershipRoleSlugsBefore?: string[];
	expectedCurrentBrokerId: Id<"brokers">;
	expectedCurrentOrgId?: string;
	lenderId: Id<"lenders">;
	lenderUserId: Id<"users">;
	targetBrokerId: Id<"brokers">;
	targetMembershipId?: string;
	targetMembershipWasPreexisting: boolean;
	targetOrgId: string;
	targetPortalId: Id<"portals">;
}

interface MarkReassignmentFailedArgs extends Record<string, unknown> {
	attemptId: Id<"lenderBrokerReassignmentAttempts">;
	currentMembershipId?: string;
	currentMembershipOperation?: CurrentMembershipOperation;
	currentMembershipRoleSlugsAfter?: string[];
	currentMembershipRoleSlugsBefore?: string[];
	failureMessage: string;
	failurePhase:
		| "target_membership"
		| "old_membership_removal"
		| "rollback"
		| "convex_patch";
	repairNeeded: boolean;
	rollbackStatus?: "not_needed" | "succeeded" | "failed";
	targetMembershipId?: string;
	targetMembershipWasPreexisting?: boolean;
}

interface ReassignBrokerResult {
	attemptId: Id<"lenderBrokerReassignmentAttempts">;
	targetBrokerId: Id<"brokers">;
	targetOrgId: string;
	targetPortalHost: string;
	targetPortalId: Id<"portals">;
}

interface TargetMembershipTransferResult {
	rollback:
		| { kind: "none" }
		| { kind: "delete"; membershipId: string }
		| {
				kind: "restore_roles";
				membershipId: string;
				originalRoleSlugs: string[];
		  };
	targetMembershipId?: string;
	targetMembershipWasPreexisting: boolean;
}

type CurrentMembershipOperation = "not_found" | "deactivated" | "role_removed";

interface CurrentMembershipRemovalResult {
	currentMembershipId?: string;
	currentMembershipOperation: CurrentMembershipOperation;
	currentMembershipRoleSlugsAfter?: string[];
	currentMembershipRoleSlugsBefore?: string[];
}

type ActionMutationCtx = Pick<ActionCtx, "runMutation">;

const LENDER_ROLE_SLUG = "lender";
const MISSING_CREATED_MEMBERSHIP_ID_ERROR =
	"WorkOS target membership creation did not return an id";

const getReassignmentActionContextRef = makeFunctionReference<
	"query",
	ReassignmentContextArgs,
	ReassignmentActionContext
>("admin/lenders/reassignmentInternal:getReassignmentActionContext");

const ensureFairLendTargetPortalRef = makeFunctionReference<
	"mutation",
	Record<string, never>,
	Id<"portals">
>("admin/lenders/reassignmentInternal:ensureFairLendTargetPortal");

const markReassignmentStartedRef = makeFunctionReference<
	"mutation",
	MarkReassignmentStartedArgs,
	Id<"lenderBrokerReassignmentAttempts">
>("admin/lenders/reassignmentInternal:markReassignmentStarted");

const completeReassignmentRef = makeFunctionReference<
	"mutation",
	CompleteReassignmentArgs,
	Id<"lenderBrokerReassignmentAttempts">
>("admin/lenders/reassignmentInternal:completeReassignment");

const markReassignmentFailedRef = makeFunctionReference<
	"mutation",
	MarkReassignmentFailedArgs,
	null
>("admin/lenders/reassignmentInternal:markReassignmentFailed");

const previewBrokerReassignmentRef = makeFunctionReference<
	"query",
	{ lenderId: Id<"lenders">; targetBrokerId: Id<"brokers"> },
	BrokerReassignmentPreview
>("admin/lenders/reassignment:previewBrokerReassignment");

function definedPortalId(portalId: Id<"portals"> | null | undefined) {
	return portalId ?? undefined;
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

function membershipRoleSlugs(membership: WorkosOrganizationMembership) {
	if (membership.roleSlugs?.length) {
		return [...new Set(membership.roleSlugs)];
	}
	if (membership.roleSlug) {
		return [membership.roleSlug];
	}
	return [];
}

function hasMembershipRole(
	membership: WorkosOrganizationMembership,
	roleSlug: string
) {
	return membershipRoleSlugs(membership).includes(roleSlug);
}

function isMissingCreatedMembershipIdError(error: unknown) {
	return (
		error instanceof Error &&
		error.message === MISSING_CREATED_MEMBERSHIP_ID_ERROR
	);
}

async function markAttemptFailed(
	ctx: ActionMutationCtx,
	args: MarkReassignmentFailedArgs
) {
	await ctx.runMutation(markReassignmentFailedRef, args);
}

async function resolveTargetPortalId(
	ctx: ActionMutationCtx,
	args: {
		actionContext: ReassignmentActionContext;
		preview: BrokerReassignmentPreview;
	}
) {
	const targetPortalId = definedPortalId(args.preview.target.portal?.portalId);
	if (targetPortalId) {
		return targetPortalId;
	}
	if (!isFairLendOwnedBroker(args.actionContext.targetBroker)) {
		throw new ConvexError("Target portal could not be resolved.");
	}
	return await ctx.runMutation(ensureFairLendTargetPortalRef, {});
}

async function transferTargetMembership(args: {
	actionContext: ReassignmentActionContext;
	attemptId: Id<"lenderBrokerReassignmentAttempts">;
	ctx: ActionMutationCtx;
	provisioning: WorkosProvisioning;
	roleSlug: "lender";
	targetOrgId: string;
}): Promise<TargetMembershipTransferResult> {
	try {
		const memberships = await args.provisioning.listOrganizationMemberships({
			organizationId: args.targetOrgId,
			statuses: ["active"],
			userId: args.actionContext.lenderUser.authId,
		});
		const activeTargetMembershipWithRole = memberships.find((membership) =>
			hasMembershipRole(membership, args.roleSlug)
		);
		if (activeTargetMembershipWithRole) {
			return {
				rollback: { kind: "none" },
				targetMembershipId: activeTargetMembershipWithRole.id,
				targetMembershipWasPreexisting: true,
			};
		}
		const activeTargetMembership = memberships[0];
		if (activeTargetMembership) {
			const originalRoleSlugs = membershipRoleSlugs(activeTargetMembership);
			const updatedRoleSlugs = [...originalRoleSlugs, args.roleSlug];
			await args.provisioning.updateOrganizationMembership(
				activeTargetMembership.id,
				{ roleSlugs: updatedRoleSlugs }
			);
			return {
				rollback: {
					kind: "restore_roles",
					membershipId: activeTargetMembership.id,
					originalRoleSlugs,
				},
				targetMembershipId: activeTargetMembership.id,
				targetMembershipWasPreexisting: true,
			};
		}
		const created = await args.provisioning.createOrganizationMembership({
			organizationId: args.targetOrgId,
			roleSlug: args.roleSlug,
			userId: args.actionContext.lenderUser.authId,
		});
		if (!created.id) {
			throw new Error(MISSING_CREATED_MEMBERSHIP_ID_ERROR);
		}
		return {
			rollback: { kind: "delete", membershipId: created.id },
			targetMembershipId: created.id,
			targetMembershipWasPreexisting: false,
		};
	} catch (error) {
		await markAttemptFailed(args.ctx, {
			attemptId: args.attemptId,
			failureMessage: errorMessage(error),
			failurePhase: "target_membership",
			repairNeeded: isMissingCreatedMembershipIdError(error),
			rollbackStatus: isMissingCreatedMembershipIdError(error)
				? "failed"
				: "not_needed",
		});
		throw error;
	}
}

async function removeCurrentMembership(args: {
	actionContext: ReassignmentActionContext;
	attemptId: Id<"lenderBrokerReassignmentAttempts">;
	ctx: ActionMutationCtx;
	provisioning: WorkosProvisioning;
	targetMembership: TargetMembershipTransferResult;
}): Promise<CurrentMembershipRemovalResult> {
	let currentMembershipRemoval: CurrentMembershipRemovalResult = {
		currentMembershipOperation: "not_found",
	};
	try {
		const oldMemberships = await args.provisioning.listOrganizationMemberships({
			organizationId: args.actionContext.currentBroker.orgId ?? "",
			statuses: ["active"],
			userId: args.actionContext.lenderUser.authId,
		});
		const oldMembership = oldMemberships.find((membership) =>
			hasMembershipRole(membership, LENDER_ROLE_SLUG)
		);
		if (!oldMembership) {
			return currentMembershipRemoval;
		}

		const previousRoleSlugs = membershipRoleSlugs(oldMembership);
		const remainingRoleSlugs = previousRoleSlugs.filter(
			(roleSlug) => roleSlug !== LENDER_ROLE_SLUG
		);
		currentMembershipRemoval = {
			currentMembershipId: oldMembership.id,
			currentMembershipOperation:
				remainingRoleSlugs.length > 0 ? "role_removed" : "deactivated",
			currentMembershipRoleSlugsAfter: remainingRoleSlugs,
			currentMembershipRoleSlugsBefore: previousRoleSlugs,
		};
		if (remainingRoleSlugs.length > 0) {
			await args.provisioning.updateOrganizationMembership(oldMembership.id, {
				roleSlugs: remainingRoleSlugs,
			});
		} else {
			await args.provisioning.deactivateOrganizationMembership(
				oldMembership.id
			);
		}
		return currentMembershipRemoval;
	} catch (error) {
		const rollback = await rollbackCreatedTargetMembership(args);
		await markAttemptFailed(args.ctx, {
			attemptId: args.attemptId,
			...currentMembershipRemoval,
			failureMessage:
				rollback.status === "failed"
					? `${errorMessage(error)} Rollback delete failed: ${rollback.failureMessage}`
					: errorMessage(error),
			failurePhase:
				rollback.status === "failed" ? "rollback" : "old_membership_removal",
			repairNeeded: rollback.status === "failed",
			rollbackStatus: rollback.status,
			targetMembershipId: args.targetMembership.targetMembershipId,
			targetMembershipWasPreexisting:
				args.targetMembership.targetMembershipWasPreexisting,
		});
		throw error;
	}
}

async function rollbackCreatedTargetMembership(args: {
	provisioning: WorkosProvisioning;
	targetMembership: TargetMembershipTransferResult;
}) {
	const rollback = args.targetMembership.rollback;
	if (rollback.kind === "none") {
		return { status: "not_needed" as const };
	}
	try {
		if (rollback.kind === "delete") {
			await args.provisioning.deleteOrganizationMembership(
				rollback.membershipId
			);
		} else {
			await args.provisioning.updateOrganizationMembership(
				rollback.membershipId,
				{ roleSlugs: rollback.originalRoleSlugs }
			);
		}
		return { status: "succeeded" as const };
	} catch (error) {
		return { failureMessage: errorMessage(error), status: "failed" as const };
	}
}

export const previewBrokerReassignment = adminQuery
	.input({ lenderId: v.id("lenders"), targetBrokerId: v.id("brokers") })
	.handler(async (ctx, args): Promise<BrokerReassignmentPreview> => {
		const lender = await ctx.db.get(args.lenderId);
		if (!lender) {
			throw new ConvexError("Lender not found");
		}

		const currentBroker = await ctx.db.get(lender.brokerId);
		if (!currentBroker) {
			throw new ConvexError("Broker not found");
		}

		const targetBroker = await ctx.db.get(args.targetBrokerId);
		if (!targetBroker) {
			throw new ConvexError("Broker not found");
		}

		const current = await buildBrokerReassignmentPartySummary(
			ctx,
			currentBroker
		);
		const target = await buildBrokerReassignmentPartySummary(ctx, targetBroker);
		const blockingReasons: string[] = [];

		if (targetBroker._id === lender.brokerId) {
			blockingReasons.push("Target broker is already assigned to this lender.");
		}
		if (targetBroker.status !== "active") {
			blockingReasons.push("Target broker is not active.");
		}
		if (!(target.portal || isFairLendOwnedBroker(targetBroker))) {
			blockingReasons.push(
				"Target external broker does not have an active published portal."
			);
		}

		const organizationWillChange = current.orgId !== target.orgId;

		return {
			blockingReasons,
			current,
			target,
			portalHostWillChange: current.portal?.host !== target.portal?.host,
			workosOperations: {
				addTargetMembership: organizationWillChange,
				deactivateCurrentMembership: organizationWillChange,
				roleSlug: "lender",
			},
		};
	})
	.public();

export const searchActiveBrokerTargets = adminQuery
	.input({ search: v.optional(v.string()) })
	.handler(async (ctx, args): Promise<BrokerReassignmentPartySummary[]> => {
		const normalizedSearch = (args.search ?? "").trim().toLowerCase();
		const brokers = await ctx.db
			.query("brokers")
			.withIndex("by_status", (query) => query.eq("status", "active"))
			.collect();
		const summaries = await Promise.all(
			brokers.map((broker) => buildBrokerReassignmentPartySummary(ctx, broker))
		);
		const filtered = normalizedSearch
			? summaries.filter((summary) =>
					[summary.displayName, summary.orgId]
						.join(" ")
						.toLowerCase()
						.includes(normalizedSearch)
				)
			: summaries;
		return filtered.slice(0, 50);
	})
	.public();

export const reassignBroker = adminAction
	.input({
		expectedCurrentBrokerId: v.id("brokers"),
		expectedCurrentOrgId: v.optional(v.string()),
		lenderId: v.id("lenders"),
		targetBrokerId: v.id("brokers"),
	})
	.handler(async (ctx, args): Promise<ReassignBrokerResult> => {
		const actionContext = await ctx.runQuery(
			getReassignmentActionContextRef,
			args
		);
		const targetOrgId = actionContext.targetBroker.orgId;
		if (!targetOrgId) {
			throw new ConvexError(
				"Target broker organization could not be resolved."
			);
		}

		const preview = await ctx.runQuery(previewBrokerReassignmentRef, {
			lenderId: args.lenderId,
			targetBrokerId: args.targetBrokerId,
		});
		if (preview.blockingReasons.length > 0) {
			throw new ConvexError(preview.blockingReasons.join(" "));
		}
		if (!preview.target.portal) {
			throw new ConvexError("Target portal could not be resolved.");
		}

		const targetPortalId = await resolveTargetPortalId(ctx, {
			actionContext,
			preview,
		});

		const attemptId = await ctx.runMutation(markReassignmentStartedRef, {
			adminAuthId: ctx.viewer.authId,
			currentBrokerId: actionContext.currentBroker._id,
			currentOrgId: actionContext.lender.orgId,
			currentPortalHost: preview.current.portal?.host,
			currentPortalId: definedPortalId(preview.current.portal?.portalId),
			lenderId: actionContext.lender._id,
			lenderUserId: actionContext.lenderUser._id,
			targetBrokerId: actionContext.targetBroker._id,
			targetOrgId,
			targetPortalHost: preview.target.portal.host,
			targetPortalId,
		});

		const provisioning = getWorkosProvisioning();
		let targetMembership: TargetMembershipTransferResult = {
			rollback: { kind: "none" },
			targetMembershipWasPreexisting: false,
		};
		let currentMembershipRemoval: CurrentMembershipRemovalResult | undefined;

		if (preview.workosOperations.addTargetMembership) {
			targetMembership = await transferTargetMembership({
				actionContext,
				attemptId,
				ctx,
				provisioning,
				roleSlug: preview.workosOperations.roleSlug,
				targetOrgId,
			});
		}

		if (preview.workosOperations.deactivateCurrentMembership) {
			currentMembershipRemoval = await removeCurrentMembership({
				actionContext,
				attemptId,
				ctx,
				provisioning,
				targetMembership,
			});
		}

		try {
			await ctx.runMutation(completeReassignmentRef, {
				attemptId,
				expectedCurrentBrokerId: actionContext.lender.brokerId,
				expectedCurrentOrgId: actionContext.lender.orgId,
				lenderId: actionContext.lender._id,
				lenderUserId: actionContext.lenderUser._id,
				...(currentMembershipRemoval ?? {}),
				targetBrokerId: actionContext.targetBroker._id,
				targetMembershipId: targetMembership.targetMembershipId,
				targetMembershipWasPreexisting:
					targetMembership.targetMembershipWasPreexisting,
				targetOrgId,
				targetPortalId,
			});
		} catch (error) {
			await markAttemptFailed(ctx, {
				attemptId,
				...(currentMembershipRemoval ?? {}),
				failureMessage: errorMessage(error),
				failurePhase: "convex_patch",
				repairNeeded: true,
				rollbackStatus: "not_needed",
				targetMembershipId: targetMembership.targetMembershipId,
				targetMembershipWasPreexisting:
					targetMembership.targetMembershipWasPreexisting,
			});
			throw error;
		}

		return {
			attemptId,
			targetBrokerId: actionContext.targetBroker._id,
			targetOrgId,
			targetPortalHost: preview.target.portal.host,
			targetPortalId,
		};
	})
	.public();
