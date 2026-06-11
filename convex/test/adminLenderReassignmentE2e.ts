import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { FAIRLEND_BROKERAGE_ORG_ID } from "../constants";
import { adminMutation } from "../fluent";
import { ensureFairLendPortal } from "../portals/homePortalAssignment";

interface ReassignmentE2eScenarioIds {
	currentBrokerId: Id<"brokers">;
	currentOrgId: string;
	currentPortalHost: string;
	currentPortalId: Id<"portals">;
	currentUserId: Id<"users">;
	lenderId: Id<"lenders">;
	lenderUserId: Id<"users">;
	organizationId: Id<"organizations">;
	targetBrokerId: Id<"brokers">;
	targetBrokerName: string;
	targetPortalHost: string;
	targetUserId: Id<"users">;
}

function assertE2eEnabled() {
	if (process.env.ALLOW_TEST_AUTH_ENDPOINTS !== "true") {
		throw new ConvexError(
			"Admin lender reassignment e2e endpoints are disabled"
		);
	}
}

function cleanSuffix(suffix: string) {
	return suffix
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, "-")
		.slice(0, 48);
}

export const seedExternalToFairLendPreviewScenario = adminMutation
	.input({ suffix: v.string() })
	.handler(async (ctx, args): Promise<ReassignmentE2eScenarioIds> => {
		assertE2eEnabled();

		const suffix = cleanSuffix(args.suffix);
		if (!suffix) {
			throw new ConvexError("E2E scenario suffix is required");
		}

		const now = Date.now();
		const currentOrgId = `org_e2e_reassignment_external_${suffix}`;
		const currentPortalHost = `reassign-${suffix}.localhost:3000`;
		const targetBrokerName = `FairLend E2E Target ${suffix}`;
		const organizationId = await ctx.db.insert("organizations", {
			allowProfilesOutsideOrganization: true,
			externalId: `e2e_reassignment_${suffix}`,
			name: `E2E External Brokerage ${suffix}`,
			workosId: currentOrgId,
		});
		const currentUserId = await ctx.db.insert("users", {
			authId: `e2e_reassign_current_broker_${suffix}`,
			email: `e2e-reassign-current-broker-${suffix}@fairlend.test`,
			firstName: "E2E",
			lastName: "Current Broker",
		});
		const targetUserId = await ctx.db.insert("users", {
			authId: `e2e_reassign_target_broker_${suffix}`,
			email: `e2e-reassign-target-broker-${suffix}@fairlend.test`,
			firstName: "E2E",
			lastName: "FairLend Broker",
		});
		const lenderUserId = await ctx.db.insert("users", {
			authId: `e2e_reassign_lender_${suffix}`,
			email: `e2e-reassign-lender-${suffix}@fairlend.test`,
			firstName: "E2E",
			lastName: "Lender",
		});
		const currentBrokerId = await ctx.db.insert("brokers", {
			brokerageName: `E2E External Brokerage ${suffix}`,
			createdAt: now,
			licenseId: `E2E-REASSIGN-CURRENT-${suffix}`,
			licenseProvince: "ON",
			onboardedAt: now,
			orgId: currentOrgId,
			status: "active",
			updatedAt: now,
			userId: currentUserId,
		});
		const targetBrokerId = await ctx.db.insert("brokers", {
			brokerageName: targetBrokerName,
			createdAt: now,
			licenseId: `E2E-REASSIGN-TARGET-${suffix}`,
			licenseProvince: "ON",
			onboardedAt: now,
			orgId: FAIRLEND_BROKERAGE_ORG_ID,
			status: "active",
			updatedAt: now,
			userId: targetUserId,
		});
		const currentPortalId = await ctx.db.insert("portals", {
			brokerId: currentBrokerId,
			createdAt: now,
			defaultPostAuthPath: "/lender/portfolio",
			isPublished: true,
			localHost: currentPortalHost,
			orgId: currentOrgId,
			portalType: "broker",
			productionHost: `reassign-${suffix}.fairlend.test`,
			publicTeaserEnabled: false,
			slug: `reassign-${suffix}`,
			status: "active",
			updatedAt: now,
		});
		const targetPortalId = await ensureFairLendPortal(ctx);
		const targetPortal = await ctx.db.get(targetPortalId);
		if (!targetPortal) {
			throw new ConvexError("FairLend portal was not created");
		}
		const lenderId = await ctx.db.insert("lenders", {
			accreditationStatus: "accredited",
			activatedAt: now,
			brokerId: currentBrokerId,
			createdAt: now,
			idvStatus: "verified",
			kycStatus: "approved",
			onboardingEntryPath: "e2e_reassignment",
			orgId: currentOrgId,
			status: "active",
			userId: lenderUserId,
		});

		return {
			currentBrokerId,
			currentOrgId,
			currentPortalHost,
			currentPortalId,
			currentUserId,
			lenderId,
			lenderUserId,
			organizationId,
			targetBrokerId,
			targetBrokerName,
			targetPortalHost: targetPortal.localHost,
			targetUserId,
		};
	})
	.public();

export const cleanupPreviewScenario = adminMutation
	.input({
		currentBrokerId: v.id("brokers"),
		currentPortalId: v.id("portals"),
		currentUserId: v.id("users"),
		lenderId: v.id("lenders"),
		lenderUserId: v.id("users"),
		organizationId: v.id("organizations"),
		targetBrokerId: v.id("brokers"),
		targetUserId: v.id("users"),
	})
	.handler(async (ctx, args) => {
		assertE2eEnabled();

		await ctx.db.delete(args.lenderId);
		await ctx.db.delete(args.currentPortalId);
		await ctx.db.delete(args.currentBrokerId);
		await ctx.db.delete(args.targetBrokerId);
		await ctx.db.delete(args.currentUserId);
		await ctx.db.delete(args.targetUserId);
		await ctx.db.delete(args.lenderUserId);
		await ctx.db.delete(args.organizationId);

		return { ok: true };
	})
	.public();
