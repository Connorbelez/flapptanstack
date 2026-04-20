import { describe, expect, it } from "vitest";
import { api } from "../../../../convex/_generated/api";
import { getRequiredDefaultOriginationOwner } from "../../../../convex/platform/defaultOriginationOwner";
import { FAIRLEND_STAFF_ORG_ID } from "../../../../convex/constants";
import { createTestConvex, ensureSeededIdentity } from "../../auth/helpers";
import { FAIRLEND_ADMIN } from "../../auth/identities";

async function getConvexErrorData(error: unknown) {
	if (typeof error === "string") {
		const parsed = JSON.parse(error) as unknown;
		return typeof parsed === "string" ? JSON.parse(parsed) : parsed;
	}
	if (
		error &&
		typeof error === "object" &&
		"data" in error &&
		typeof error.data === "string"
	) {
		const parsed = JSON.parse(error.data) as unknown;
		return typeof parsed === "string" ? JSON.parse(parsed) : parsed;
	}
	if (error && typeof error === "object" && "data" in error) {
		return error.data;
	}
	return undefined;
}

describe("default origination owner", () => {
	it("fails closed when the singleton settings row is missing", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);

		const error = await t
			.run(async (ctx) => {
				await getRequiredDefaultOriginationOwner(ctx);
			})
			.catch((caughtError: unknown) => caughtError);

		expect(await getConvexErrorData(error)).toMatchObject({
			code: "DEFAULT_ORIGINATION_OWNER_MISSING",
		});
	});

	it("writes a governance audit entry when the default pair changes", async () => {
		const t = createTestConvex();
		const userId = await ensureSeededIdentity(t, FAIRLEND_ADMIN);

		const { lenderId, vehicleId, workspaceId } = await t.run(async (ctx) => {
			const brokerId = await ctx.db.insert("brokers", {
				createdAt: Date.now(),
				lastTransitionAt: Date.now(),
				onboardedAt: Date.now(),
				orgId: FAIRLEND_STAFF_ORG_ID,
				status: "active",
				userId,
			});
			const lenderId = await ctx.db.insert("lenders", {
				accreditationStatus: "exempt",
				brokerId,
				createdAt: Date.now(),
				onboardingEntryPath: "admin_dashboard",
				orgId: FAIRLEND_STAFF_ORG_ID,
				status: "active",
				userId,
			});
			const vehicleId = await ctx.db.insert("investmentVehicles", {
				lenderId,
				name: "FairLend MIC",
				legalName: "FairLend MIC",
				entityType: "mic",
				status: "active",
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
			const workspaceId = await ctx.db.insert("investmentVehicleWorkspaces", {
				investmentVehicleId: vehicleId,
				name: "FairLend MIC Workspace",
				status: "active",
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
			return { lenderId, vehicleId, workspaceId };
		});

		const result = await t.withIdentity(FAIRLEND_ADMIN).mutation(
			api.platform.defaultOriginationOwner.setDefaultOriginationOwner,
			{
				changeReason: "Promote FairLend MIC to canonical origination owner",
				defaultOriginationInvestmentVehicleId: vehicleId,
				defaultOriginationLenderId: lenderId,
				defaultOriginationWorkspaceId: workspaceId,
			}
		);

		expect(result.settings.key).toBe("default");

		const auditEntry = await t.run(async (ctx) => {
			return ctx.db
				.query("auditJournal")
				.withIndex("by_entity", (q) =>
					q
						.eq("entityType", "platformSetting")
						.eq("entityId", String(result.settings._id))
				)
				.first();
		});

		expect(auditEntry?.eventType).toBe("DEFAULT_ORIGINATION_OWNER_SET");
	});
});
