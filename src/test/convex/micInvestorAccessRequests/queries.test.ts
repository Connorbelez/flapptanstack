import { describe, expect, it } from "vitest";
import { api } from "../../../../convex/_generated/api";
import { auditLog } from "../../../../convex/auditLog";
import { FAIRLEND_ADMIN, MEMBER } from "../../auth/identities";
import {
	createMicRequestTestConvex,
	seedAdmin,
	seedMicPortal,
	seedRequest,
	submitPublicRequest,
} from "./helpers";

describe("MIC investor access request admin queries", () => {
	it("defaults the admin list to pending requests sorted newest first", async () => {
		const t = createMicRequestTestConvex();
		await seedAdmin(t);
		const portalId = await seedMicPortal(t);
		await seedRequest(t, {
			email: "old-pending@example.com",
			portalId,
			requestedAt: 100,
			status: "pending_review",
		});
		await seedRequest(t, {
			email: "approved@example.com",
			portalId,
			requestedAt: 200,
			status: "approved",
		});
		await seedRequest(t, {
			email: "new-pending@example.com",
			portalId,
			requestedAt: 300,
			status: "pending_review",
		});

		const results = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(api.micInvestorAccessRequests.queries.listAdminRequests, {});

		expect(results.map((row) => row.request.normalizedEmail)).toEqual([
			"new-pending@example.com",
			"old-pending@example.com",
		]);
		expect(results[0]?.portal?._id).toBe(portalId);
	});

	it("filters admin list by portal, status, provisioning state, and requested date", async () => {
		const t = createMicRequestTestConvex();
		await seedAdmin(t);
		const portalId = await seedMicPortal(t);
		const otherPortalId = await seedMicPortal(t, {
			localHost: "other-mic.localhost:3000",
			productionHost: "other-mic.fairlend.ca",
			slug: "other-mic",
		});
		await seedRequest(t, {
			email: "included@example.com",
			portalId,
			provisioningState: "failed",
			requestedAt: 200,
			status: "approved",
		});
		await seedRequest(t, {
			email: "wrong-provisioning@example.com",
			portalId,
			provisioningState: "completed",
			requestedAt: 210,
			status: "approved",
		});
		await seedRequest(t, {
			email: "wrong-portal@example.com",
			portalId: otherPortalId,
			provisioningState: "failed",
			requestedAt: 220,
			status: "approved",
		});
		await seedRequest(t, {
			email: "outside-window@example.com",
			portalId,
			provisioningState: "failed",
			requestedAt: 500,
			status: "approved",
		});

		const results = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(api.micInvestorAccessRequests.queries.listAdminRequests, {
				portalId,
				provisioningState: "failed",
				requestedAtFrom: 150,
				requestedAtTo: 250,
				status: "approved",
			});

		expect(results).toHaveLength(1);
		expect(results[0]?.request.normalizedEmail).toBe("included@example.com");
		expect(results[0]?.request.provisioningState).toBe("failed");
	});

	it("returns request, portal, audit events, and journal rows for admin detail", async () => {
		const t = createMicRequestTestConvex();
		await seedAdmin(t);
		const portalId = await seedMicPortal(t);
		await submitPublicRequest(t, {
			email: "detail@example.com",
			portalId,
		});
		const list = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(api.micInvestorAccessRequests.queries.listAdminRequests, {
				portalId,
			});
		const requestId = list[0]?.request._id;
		expect(requestId).toBeDefined();
		if (!requestId) {
			throw new Error("Expected request id");
		}

		await t.run(async (ctx) => {
			await auditLog.log(ctx, {
				action: "micInvestorAccessRequest.test_detail_event",
				actorId: "test",
				resourceId: requestId,
				resourceType: "micInvestorAccessRequests",
				severity: "info",
				metadata: { marker: "detail" },
			});
		});

		const detail = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(api.micInvestorAccessRequests.queries.getAdminRequestDetail, {
				requestId,
			});

		expect(detail?.request.normalizedEmail).toBe("detail@example.com");
		expect(detail?.portal?._id).toBe(portalId);
		expect(detail?.journalEvents).toHaveLength(1);
		expect(
			detail?.auditEvents.some(
				(event) =>
					event.action === "micInvestorAccessRequest.test_detail_event"
			)
		).toBe(true);
	});

	it("returns null for missing request detail", async () => {
		const t = createMicRequestTestConvex();
		await seedAdmin(t);
		const portalId = await seedMicPortal(t);
		const requestId = await seedRequest(t, {
			email: "deleted@example.com",
			portalId,
			status: "pending_review",
		});
		await t.run(async (ctx) => {
			await ctx.db.delete(requestId);
		});

		await expect(
			t
				.withIdentity(FAIRLEND_ADMIN)
				.query(api.micInvestorAccessRequests.queries.getAdminRequestDetail, {
					requestId,
				})
		).resolves.toBeNull();
	});

	it("rejects non-admin callers", async () => {
		const t = createMicRequestTestConvex();
		const portalId = await seedMicPortal(t);

		await expect(
			t.withIdentity(MEMBER).query(
				api.micInvestorAccessRequests.queries.listAdminRequests,
				{
					portalId,
				}
			)
		).rejects.toThrow("Forbidden");
	});
});
