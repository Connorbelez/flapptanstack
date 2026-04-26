import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { auditLog } from "../../../../convex/auditLog";
import { normalizeMicInvestorAccessRequestEmail } from "../../../../convex/micInvestorAccessRequests/mutations";
import {
	fairLendPortalFields,
	micPortalFields,
} from "../../../../convex/portals/helpers";
import { createConvexTestKit } from "../testKit";

const MIC_ORG_ID = "org_mic_investors";
const MIC_LENDER_AUTH_ID = "lender_auth_mic";

type TestConvex = ReturnType<typeof createConvexTestKit>;

async function seedMicPortal(
	t: TestConvex,
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

async function seedFairLendPortal(t: TestConvex) {
	return t.run(async (ctx) => {
		return await ctx.db.insert("portals", fairLendPortalFields(Date.now()));
	});
}

async function submitPublicRequest(
	t: TestConvex,
	args: { email: string; portalId: Id<"portals"> }
) {
	return await t.mutation(
		api.micInvestorAccessRequests.mutations.submitPublicRequest,
		args
	);
}

async function getRequests(t: TestConvex, portalId: Id<"portals">) {
	return await t.run(async (ctx) => {
		return await ctx.db
			.query("micInvestorAccessRequests")
			.withIndex("by_portal_status", (q) => q.eq("portalId", portalId))
			.collect();
	});
}

async function getRequestByStatus(
	t: TestConvex,
	portalId: Id<"portals">,
	status: "approved" | "pending_review" | "rejected"
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

async function seedRequest(
	t: TestConvex,
	args: {
		email: string;
		portalId: Id<"portals">;
		status: "approved" | "pending_review" | "rejected";
	}
) {
	const normalizedEmail = normalizeMicInvestorAccessRequestEmail(args.email);
	return await t.run(async (ctx) => {
		return await ctx.db.insert("micInvestorAccessRequests", {
			email: args.email.trim(),
			normalizedEmail,
			portalId: args.portalId,
			status: args.status,
			provisioningState: "not_started",
			requestedAt: Date.now(),
		});
	});
}

async function getAuditJournalRows(
	t: TestConvex,
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

async function getAuditLogEvents(
	t: TestConvex,
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

describe("MIC investor access request intake", () => {
	it("normalizes email by trimming and lowercasing", () => {
		expect(
			normalizeMicInvestorAccessRequestEmail(" Investor@Example.COM ")
		).toBe("investor@example.com");
	});

	it("rejects invalid email-like strings", () => {
		expect(() => normalizeMicInvestorAccessRequestEmail("not-an-email")).toThrow(
			ConvexError
		);
	});

	it("creates a pending public request for an active MIC portal without auth", async () => {
		const t = createConvexTestKit();
		const portalId = await seedMicPortal(t);

		await expect(
			submitPublicRequest(t, {
				email: " Investor@Example.COM ",
				portalId,
			})
		).resolves.toEqual({ ok: true, status: "received" });

		const requests = await getRequests(t, portalId);
		expect(requests).toHaveLength(1);
		expect(requests[0]).toMatchObject({
			email: "Investor@Example.COM",
			normalizedEmail: "investor@example.com",
			portalId,
			provisioningState: "not_started",
			status: "pending_review",
		});
		expect(requests[0]?.requestedAt).toEqual(expect.any(Number));
	});

	it("returns generic success for duplicate pending requests without inserting another active row", async () => {
		const t = createConvexTestKit();
		const portalId = await seedMicPortal(t);

		await submitPublicRequest(t, {
			email: "Investor@Example.com",
			portalId,
		});
		await expect(
			submitPublicRequest(t, {
				email: " investor@example.COM ",
				portalId,
			})
		).resolves.toEqual({ ok: true, status: "received" });

		const pendingRequests = await getRequestByStatus(
			t,
			portalId,
			"pending_review"
		);
		expect(pendingRequests).toHaveLength(1);
		expect(pendingRequests[0]?.normalizedEmail).toBe("investor@example.com");
	});

	it("keeps concurrent duplicate submissions to one active pending request", async () => {
		const t = createConvexTestKit();
		const portalId = await seedMicPortal(t);

		const results = await Promise.all([
			submitPublicRequest(t, {
				email: " Investor@Example.com ",
				portalId,
			}),
			submitPublicRequest(t, {
				email: "investor@example.COM",
				portalId,
			}),
		]);

		expect(results).toEqual([
			{ ok: true, status: "received" },
			{ ok: true, status: "received" },
		]);
		const pendingRequests = await getRequestByStatus(
			t,
			portalId,
			"pending_review"
		);
		expect(pendingRequests).toHaveLength(1);
		expect(pendingRequests[0]?.normalizedEmail).toBe("investor@example.com");
	});

	it("returns generic success for duplicate approved requests without exposing approval", async () => {
		const t = createConvexTestKit();
		const portalId = await seedMicPortal(t);
		await seedRequest(t, {
			email: "investor@example.com",
			portalId,
			status: "approved",
		});

		await expect(
			submitPublicRequest(t, {
				email: "INVESTOR@example.com",
				portalId,
			})
		).resolves.toEqual({ ok: true, status: "received" });

		expect(await getRequests(t, portalId)).toHaveLength(1);
		expect(await getRequestByStatus(t, portalId, "approved")).toHaveLength(1);
	});

	it("allows a rejected email to submit a new pending request later", async () => {
		const t = createConvexTestKit();
		const portalId = await seedMicPortal(t);
		await seedRequest(t, {
			email: "investor@example.com",
			portalId,
			status: "rejected",
		});

		await expect(
			submitPublicRequest(t, {
				email: " investor@example.com ",
				portalId,
			})
		).resolves.toEqual({ ok: true, status: "received" });

		expect(await getRequestByStatus(t, portalId, "rejected")).toHaveLength(1);
		const pendingRequests = await getRequestByStatus(
			t,
			portalId,
			"pending_review"
		);
		expect(pendingRequests).toHaveLength(1);
		expect(pendingRequests[0]?.normalizedEmail).toBe("investor@example.com");
	});

	it("fails closed for invalid, non-MIC, unpublished, suspended, and missing-mapping portals", async () => {
		const t = createConvexTestKit();
		const validMicPortalId = await seedMicPortal(t);
		const nonMicPortalId = await seedFairLendPortal(t);
		const unpublishedPortalId = await seedMicPortal(t, {
			isPublished: false,
			localHost: "unpublished-mic.localhost:3000",
			productionHost: "unpublished-mic.fairlend.ca",
			slug: "unpublished-mic",
		});
		const suspendedPortalId = await seedMicPortal(t, {
			localHost: "suspended-mic.localhost:3000",
			productionHost: "suspended-mic.fairlend.ca",
			slug: "suspended-mic",
			status: "suspended",
		});
		const missingMappingPortalId = await seedMicPortal(t, {
			localHost: "missing-mapping-mic.localhost:3000",
			micLenderAuthId: " ",
			productionHost: "missing-mapping-mic.fairlend.ca",
			slug: "missing-mapping-mic",
		});
		const deletedPortalId = await seedMicPortal(t, {
			localHost: "deleted-mic.localhost:3000",
			productionHost: "deleted-mic.fairlend.ca",
			slug: "deleted-mic",
		});
		await t.run(async (ctx) => {
			await ctx.db.delete(deletedPortalId);
		});

		for (const portalId of [
			nonMicPortalId,
			unpublishedPortalId,
			suspendedPortalId,
			missingMappingPortalId,
			deletedPortalId,
		]) {
			await expect(
				submitPublicRequest(t, {
					email: "investor@example.com",
					portalId,
				})
			).rejects.toThrow("MIC access requests are not available");
		}
	});

	it("rejects invalid emails through the public mutation", async () => {
		const t = createConvexTestKit();
		const portalId = await seedMicPortal(t);

		await expect(
			submitPublicRequest(t, {
				email: "not-an-email",
				portalId,
			})
		).rejects.toThrow("Enter a valid email address");

		expect(await getRequests(t, portalId)).toHaveLength(0);
	});

	it("writes audit journal and audit log rows for actual creation writes", async () => {
		const t = createConvexTestKit();
		const portalId = await seedMicPortal(t);

		await submitPublicRequest(t, {
			email: "investor@example.com",
			portalId,
		});

		const requests = await getRequests(t, portalId);
		const requestId = requests[0]?._id;
		expect(requestId).toBeDefined();
		if (!requestId) {
			throw new Error("Expected MIC request id");
		}

		const journalRows = await getAuditJournalRows(t, requestId);
		expect(journalRows).toHaveLength(1);
		expect(journalRows[0]).toMatchObject({
			actorId: "public:mic-access-request",
			actorType: "system",
			channel: "onboarding_portal",
			entityId: requestId,
			entityType: "micInvestorAccessRequest",
			eventType: "CREATED",
			newState: "pending_review",
			outcome: "transitioned",
			previousState: "none",
		});

		const auditEvents = await getAuditLogEvents(t, requestId);
		const createdEvent = auditEvents.find(
			(event) => event.action === "transition.micInvestorAccessRequest.created"
		);
		expect(createdEvent).toBeDefined();
		expect(createdEvent?.metadata).toMatchObject({
			entityType: "micInvestorAccessRequest",
			eventType: "CREATED",
			journalEntryId: journalRows[0]?._id,
			newState: "pending_review",
			previousState: "none",
		});
	});
});
