import { v } from "convex/values";
import { auditLog } from "../../auditLog";
import { adminMutation, requirePermission } from "../../fluent";
import {
	type PublishListingResult,
	publishListingRecord,
} from "../../listings/lifecycle";
import {
	getBrokerPortalPricingSetting,
	setBrokerPortalPricingSetting,
	syncAllPortalPricingSelections,
} from "../../portals/pricing";

export const setBrokerPortalPricing = adminMutation
	.input({
		brokerSplitPercent: v.number(),
	})
	.handler(async (ctx, args) => {
		const previousSetting = await getBrokerPortalPricingSetting(ctx);
		const previousBrokerSplitPercent = previousSetting?.brokerSplitPercent ?? 0;
		const setting = await setBrokerPortalPricingSetting(ctx, {
			brokerSplitPercent: args.brokerSplitPercent,
			updatedByAuthId: ctx.viewer.authId,
		});
		const sync = await syncAllPortalPricingSelections(ctx, {
			updatedByAuthId: ctx.viewer.authId,
		});

		if (previousBrokerSplitPercent !== setting.brokerSplitPercent) {
			await auditLog.log(ctx, {
				action: "portal.broker_pricing.updated",
				actorId: ctx.viewer.authId,
				resourceType: "brokerPortalPricingSettings",
				resourceId: setting._id,
				severity: "info",
				metadata: {
					brokerPortalCount: sync.brokerPortalCount,
					brokerPortalsUpdated: sync.brokerPortalsUpdated,
					fairLendPortalsUpdated: sync.fairLendPortalsUpdated,
					newBrokerSplitPercent: setting.brokerSplitPercent,
					previousBrokerSplitPercent,
				},
			});
		}

		return {
			brokerPortalCount: sync.brokerPortalCount,
			brokerPortalsUpdated: sync.brokerPortalsUpdated,
			brokerSplitPercent: setting.brokerSplitPercent,
			fairLendPortalsUpdated: sync.fairLendPortalsUpdated,
			lastUpdatedAt: setting.updatedAt,
		};
	})
	.public();

export const publishListing = adminMutation
	.use(requirePermission("listing:manage"))
	.input({
		listingId: v.id("listings"),
	})
	.handler(async (ctx, args): Promise<PublishListingResult> => {
		return publishListingRecord(ctx, {
			actorAuthId: ctx.viewer.authId,
			listingId: args.listingId,
			now: Date.now(),
		});
	})
	.public();
