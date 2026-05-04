import { ConvexError, v } from "convex/values";
import { auditLog } from "../auditLog";
import { appendAuditJournalEntry } from "../engine/auditJournal";
import { convex } from "../fluent";
import { resolveMicPortalConfig } from "../portals/micConfig";
import {
	MIC_INVESTOR_ACCESS_REQUEST_RECEIVED,
	micInvestorAccessRequestSubmitResultValidator,
} from "./validators";

const PUBLIC_MIC_ACCESS_REQUEST_ACTOR_ID = "public:mic-access-request";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeMicInvestorAccessRequestEmail(email: string) {
	const normalizedEmail = email.trim().toLowerCase();

	if (!EMAIL_PATTERN.test(normalizedEmail)) {
		throw new ConvexError("Enter a valid email address");
	}

	return normalizedEmail;
}

export const submitPublicRequest = convex
	.mutation()
	.input({
		email: v.string(),
		portalId: v.id("portals"),
	})
	.returns(micInvestorAccessRequestSubmitResultValidator)
	.handler(async (ctx, args) => {
		const normalizedEmail = normalizeMicInvestorAccessRequestEmail(args.email);
		const portalConfig = await resolveMicPortalConfig(ctx, args.portalId);

		if (portalConfig.availability !== "active") {
			throw new ConvexError("MIC access requests are not available");
		}

		const activeRequestStatuses = ["pending_review", "approved"] as const;
		for (const status of activeRequestStatuses) {
			const existingRequest = await ctx.db
				.query("micInvestorAccessRequests")
				.withIndex("by_portal_email_status", (q) =>
					q
						.eq("portalId", portalConfig.portalId)
						.eq("normalizedEmail", normalizedEmail)
						.eq("status", status)
				)
				.first();

			if (existingRequest) {
				return MIC_INVESTOR_ACCESS_REQUEST_RECEIVED;
			}
		}

		const requestedAt = Date.now();
		const requestId = await ctx.db.insert("micInvestorAccessRequests", {
			email: args.email.trim(),
			normalizedEmail,
			portalId: portalConfig.portalId,
			status: "pending_review",
			provisioningState: "not_started",
			requestedAt,
		});

		const journalEntryId = await appendAuditJournalEntry(ctx, {
			actorId: PUBLIC_MIC_ACCESS_REQUEST_ACTOR_ID,
			actorType: "system",
			channel: "onboarding_portal",
			organizationId: portalConfig.orgId,
			entityId: requestId,
			entityType: "micInvestorAccessRequest",
			eventType: "CREATED",
			payload: {
				portalId: portalConfig.portalId,
				provisioningState: "not_started",
				status: "pending_review",
			},
			previousState: "none",
			newState: "pending_review",
			outcome: "transitioned",
			timestamp: requestedAt,
		});

		await auditLog.log(ctx, {
			action: "transition.micInvestorAccessRequest.created",
			actorId: PUBLIC_MIC_ACCESS_REQUEST_ACTOR_ID,
			resourceType: "micInvestorAccessRequests",
			resourceId: requestId,
			severity: "info",
			metadata: {
				entityType: "micInvestorAccessRequest",
				eventType: "CREATED",
				previousState: "none",
				newState: "pending_review",
				outcome: "transitioned",
				journalEntryId,
				portalId: portalConfig.portalId,
				source: {
					channel: "onboarding_portal",
					actorId: PUBLIC_MIC_ACCESS_REQUEST_ACTOR_ID,
					actorType: "system",
				},
			},
		});

		return MIC_INVESTOR_ACCESS_REQUEST_RECEIVED;
	})
	.public();
