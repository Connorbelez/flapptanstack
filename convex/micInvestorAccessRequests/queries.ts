import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { auditLog } from "../auditLog";
import { adminQuery, requirePermission } from "../fluent";
import {
	micInvestorAccessRequestProvisioningStateValidator,
	micInvestorAccessRequestStatusValidator,
} from "./validators";

const micInvestorAccessRequestAdminQuery = adminQuery.use(
	requirePermission("onboarding:manage")
);

export const listAdminRequests = micInvestorAccessRequestAdminQuery
	.input({
		portalId: v.optional(v.id("portals")),
		status: v.optional(micInvestorAccessRequestStatusValidator),
		provisioningState: v.optional(
			micInvestorAccessRequestProvisioningStateValidator
		),
		requestedAtFrom: v.optional(v.number()),
		requestedAtTo: v.optional(v.number()),
	})
	.handler(async (ctx, args) => {
		const status = args.status ?? "pending_review";
		let requests: Doc<"micInvestorAccessRequests">[];
		if (args.portalId !== undefined) {
			const portalId = args.portalId;
			requests = await ctx.db
				.query("micInvestorAccessRequests")
				.withIndex("by_portal_status", (q) =>
					q.eq("portalId", portalId).eq("status", status)
				)
				.collect();
		} else {
			requests = await ctx.db
				.query("micInvestorAccessRequests")
				.withIndex("by_requested_at")
				.collect();
		}

		const filteredRequests = requests
			.filter((request) => request.status === status)
			.filter((request) =>
				args.provisioningState === undefined
					? true
					: request.provisioningState === args.provisioningState
			)
			.filter((request) =>
				args.requestedAtFrom === undefined
					? true
					: request.requestedAt >= args.requestedAtFrom
			)
			.filter((request) =>
				args.requestedAtTo === undefined
					? true
					: request.requestedAt <= args.requestedAtTo
			)
			.sort((left, right) => right.requestedAt - left.requestedAt);

		return await Promise.all(
			filteredRequests.map(async (request) => {
				const portal = await ctx.db.get(request.portalId);
				return { portal, request };
			})
		);
	})
	.public();

export const getAdminRequestDetail = micInvestorAccessRequestAdminQuery
	.input({ requestId: v.id("micInvestorAccessRequests") })
	.handler(async (ctx, args) => {
		const request = await ctx.db.get(args.requestId);
		if (!request) {
			return null;
		}

		const [portal, auditEvents, journalEvents] = await Promise.all([
			ctx.db.get(request.portalId),
			auditLog.queryByResource(ctx, {
				resourceType: "micInvestorAccessRequests",
				resourceId: args.requestId,
				limit: 100,
			}),
			ctx.db
				.query("auditJournal")
				.withIndex("by_entity", (q) =>
					q
						.eq("entityType", "micInvestorAccessRequest")
						.eq("entityId", args.requestId)
				)
				.collect(),
		]);

		return {
			auditEvents,
			journalEvents,
			portal,
			request,
		};
	})
	.public();
