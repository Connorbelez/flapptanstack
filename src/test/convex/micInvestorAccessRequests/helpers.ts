import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { auditLog } from "../../../../convex/auditLog";
import { normalizeMicInvestorAccessRequestEmail } from "../../../../convex/micInvestorAccessRequests/mutations";
import {
	fairLendPortalFields,
	micPortalFields,
} from "../../../../convex/portals/helpers";
import { FAIRLEND_ADMIN } from "../../auth/identities";
import { ensureSeededIdentity } from "../../auth/helpers";
import { createConvexTestKit } from "../testKit";

export const MIC_ORG_ID = "org_mic_investors";
export const MIC_LENDER_AUTH_ID = "lender_auth_mic";

export type MicInvestorAccessRequestStatus =
	| "approved"
	| "pending_review"
	| "rejected";

export type MicInvestorAccessRequestProvisioningState =
	| "completed"
	| "failed"
	| "in_progress"
	| "not_started";

export type MicRequestTestConvex = ReturnType<typeof createConvexTestKit>;

export function createMicRequestTestConvex() {
	return createConvexTestKit();
}

export async function seedAdmin(t: MicRequestTestConvex) {
	return ensureSeededIdentity(t, FAIRLEND_ADMIN);
}

export async function seedMicPortal(
	t: MicRequestTestConvex,
	overrides?: Partial<ReturnType<typeof micPortalFields>>
) {
	return t.run(async (ctx) => {
		return await ctx.db.insert("portals", {
			...micPortalFields({
				micLenderAuthId: MIC_LENDER_AUTH_ID,
				now: Date.now(),
				orgId: MIC_ORG_ID,
			}),
			...overrides,
		});
	});
}

export async function seedFairLendPortal(t: MicRequestTestConvex) {
	return t.run(async (ctx) => {
		return await ctx.db.insert("portals", fairLendPortalFields(Date.now()));
	});
}

export async function submitPublicRequest(
	t: MicRequestTestConvex,
	args: { email: string; portalId: Id<"portals"> }
) {
	return await t.mutation(
		api.micInvestorAccessRequests.mutations.submitPublicRequest,
		args
	);
}

export async function seedRequest(
	t: MicRequestTestConvex,
	args: {
		email: string;
		portalId: Id<"portals">;
		provisioningError?: string;
		provisioningState?: MicInvestorAccessRequestProvisioningState;
		requestedAt?: number;
		rejectionReason?: string;
		reviewedAt?: number;
		reviewedBy?: string;
		status: MicInvestorAccessRequestStatus;
	}
) {
	const normalizedEmail = normalizeMicInvestorAccessRequestEmail(args.email);
	return await t.run(async (ctx) => {
		return await ctx.db.insert("micInvestorAccessRequests", {
			email: args.email.trim(),
			normalizedEmail,
			portalId: args.portalId,
			status: args.status,
			provisioningState: args.provisioningState ?? "not_started",
			provisioningError: args.provisioningError,
			requestedAt: args.requestedAt ?? Date.now(),
			rejectionReason: args.rejectionReason,
			reviewedAt: args.reviewedAt,
			reviewedBy: args.reviewedBy,
		});
	});
}

export async function getRequests(
	t: MicRequestTestConvex,
	portalId: Id<"portals">
) {
	return await t.run(async (ctx) => {
		return await ctx.db
			.query("micInvestorAccessRequests")
			.withIndex("by_portal_status", (q) => q.eq("portalId", portalId))
			.collect();
	});
}

export async function getRequestByStatus(
	t: MicRequestTestConvex,
	portalId: Id<"portals">,
	status: MicInvestorAccessRequestStatus
) {
	return await t.run(async (ctx) => {
		return await ctx.db
			.query("micInvestorAccessRequests")
			.withIndex("by_portal_status", (q) =>
				q.eq("portalId", portalId).eq("status", status)
			)
			.collect();
	});
}

export async function getAuditJournalRows(
	t: MicRequestTestConvex,
	requestId: Id<"micInvestorAccessRequests">
) {
	return await t.run(async (ctx) => {
		return await ctx.db
			.query("auditJournal")
			.withIndex("by_entity", (q) =>
				q.eq("entityType", "micInvestorAccessRequest").eq("entityId", requestId)
			)
			.collect();
	});
}

export async function getAuditLogEvents(
	t: MicRequestTestConvex,
	requestId: Id<"micInvestorAccessRequests">
) {
	return await t.run(async (ctx) => {
		return await auditLog.queryByResource(ctx, {
			resourceType: "micInvestorAccessRequests",
			resourceId: requestId,
			limit: 100,
		});
	});
}
