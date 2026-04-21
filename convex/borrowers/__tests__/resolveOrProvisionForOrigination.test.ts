import { describe, expect, it } from "vitest";
import { createTestConvex } from "../../../src/test/auth/helpers";
import type { Id } from "../../_generated/dataModel";
import { DEFAULT_PORTAL_POST_AUTH_PATH } from "../../portals/helpers";
import { ensureCanonicalBorrowerForOrigination } from "../resolveOrProvisionForOrigination";

describe("ensureCanonicalBorrowerForOrigination", () => {
	it("updates the linked user's home portal immediately when it creates a borrower", async () => {
		const t = createTestConvex();

		const result = await t.run(async (ctx) => {
			const now = Date.now();
			const orgId = "org_meridian_origination";
			const userId = await ctx.db.insert("users", {
				authId: "user_origination_runtime_sync",
				email: "runtime-sync@test.fairlend.ca",
				firstName: "Runtime",
				lastName: "Sync",
			});
			const portalId = await ctx.db.insert("portals", {
				slug: "meridian",
				portalType: "broker",
				orgId,
				productionHost: "meridian.fairlend.ca",
				localHost: "meridian.localhost:3000",
				status: "active",
				isPublished: true,
				publicTeaserEnabled: true,
				teaserListingLimit: 12,
				defaultPostAuthPath: DEFAULT_PORTAL_POST_AUTH_PATH,
				createdAt: now,
				updatedAt: now,
			});

			const borrowerResult = await ensureCanonicalBorrowerForOrigination(ctx, {
				creationSource: "test_runtime_sync",
				now,
				orgId,
				originatingWorkflowId: "workflow_runtime_sync",
				originatingWorkflowType: "admin_origination_case",
				userId,
				workflowSourceId: "case_runtime_sync",
				workflowSourceKey: "case_runtime_sync:primary",
			});
			const user = await ctx.db.get(userId);

			return {
				borrowerId: borrowerResult.borrowerId,
				homePortalId: user?.homePortalId,
				portalId,
				wasCreated: borrowerResult.wasCreated,
			};
		});

		expect(result.wasCreated).toBe(true);
		expect(result.borrowerId).toBeTruthy();
		expect(result.homePortalId).toBe(result.portalId as Id<"portals">);
	});
});
