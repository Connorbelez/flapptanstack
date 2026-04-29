import { ConvexError } from "convex/values";
import { auditLog } from "../auditLog";
import { buildSource } from "../engine/commands";
import { executeTransition } from "../engine/transition";
import { adminMutation, convex, requirePermission } from "../fluent";
import {
	micInvestorAccessApproveArgsValidator,
	micInvestorAccessRejectArgsValidator,
	micInvestorAccessSubmitArgsValidator,
} from "./validators";

export const submitRequest = convex
	.mutation()
	.input(micInvestorAccessSubmitArgsValidator)
	.handler(async (ctx, args) => {
		const normalizedEmail = args.email.trim().toLowerCase();
		const portal = await ctx.db
			.query("portals")
			.withIndex("by_slug", (query) => query.eq("slug", args.portalSlug))
			.unique();

		if (!portal || portal.portalType !== "mic") {
			throw new ConvexError("MIC portal not found");
		}

		const existing = await ctx.db
			.query("micInvestorAccessRequests")
			.withIndex("by_portal_normalized_email", (query) =>
				query.eq("portalId", portal._id).eq("normalizedEmail", normalizedEmail)
			)
			.collect();

		const reusableRequest = existing.find(
			(request) =>
				request.status === "pending_review" || request.status === "approved"
		);
		if (reusableRequest) {
			return { ok: true };
		}

		const now = Date.now();
		const requestId = await ctx.db.insert("micInvestorAccessRequests", {
			email: args.email.trim(),
			normalizedEmail,
			portalId: portal._id,
			status: "pending_review",
			provisioningState: "pending",
			createdAt: now,
			updatedAt: now,
		});

		await auditLog.log(ctx, {
			action: "mic_investor_access.request_submitted",
			actorId: "public",
			resourceType: "micInvestorAccessRequests",
			resourceId: requestId,
			severity: "info",
			metadata: {
				email: normalizedEmail,
				portalId: portal._id,
				portalSlug: portal.slug,
			},
		});

		return { ok: true };
	})
	.public();

export const approveRequest = adminMutation
	.use(requirePermission("admin:access"))
	.input(micInvestorAccessApproveArgsValidator)
	.handler(async (ctx, args) => {
		const result = await executeTransition(ctx, {
			entityType: "micInvestorAccessRequest",
			entityId: args.requestId,
			eventType: "APPROVE",
			payload: {},
			source: buildSource(ctx.viewer, "admin_dashboard"),
		});

		if (!result.success) {
			throw new ConvexError(result.reason ?? "Transition failed");
		}

		await ctx.db.patch(args.requestId, {
			reviewedAt: Date.now(),
			reviewedBy: ctx.viewer.authId,
			updatedAt: Date.now(),
		});

		return { ok: true, transition: result };
	})
	.public();

export const rejectRequest = adminMutation
	.use(requirePermission("admin:access"))
	.input(micInvestorAccessRejectArgsValidator)
	.handler(async (ctx, args) => {
		const result = await executeTransition(ctx, {
			entityType: "micInvestorAccessRequest",
			entityId: args.requestId,
			eventType: "REJECT",
			payload: { rejectionReason: args.rejectionReason },
			source: buildSource(ctx.viewer, "admin_dashboard"),
		});

		if (!result.success) {
			throw new ConvexError(result.reason ?? "Transition failed");
		}

		await ctx.db.patch(args.requestId, {
			rejectionReason: args.rejectionReason,
			reviewedAt: Date.now(),
			reviewedBy: ctx.viewer.authId,
			updatedAt: Date.now(),
		});

		return { ok: true, transition: result };
	})
	.public();
