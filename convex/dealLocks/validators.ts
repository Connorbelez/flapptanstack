import { v } from "convex/values";

export const DEAL_LOCK_CHECKOUT_TIMEOUT_MS = 5 * 60 * 1000;
export const DEAL_LOCK_FEE_AMOUNT_CENTS = 25_000;
export const DEAL_LOCK_FEE_CURRENCY = "cad";

export const dealLockCheckoutStatusValidator = v.union(
	v.literal("created"),
	v.literal("paid"),
	v.literal("expired"),
	v.literal("refunded"),
	v.literal("failed")
);

export const dealLockSelectedLawyerTypeValidator = v.union(
	v.literal("platform_lawyer"),
	v.literal("guest_lawyer")
);

export const dealLockRefundStatusValidator = v.union(
	v.literal("none"),
	v.literal("needed"),
	v.literal("requested"),
	v.literal("refunded"),
	v.literal("failed")
);

export const dealLockFeeCollectionProviderValidator = v.union(
	v.literal("stripe_checkout"),
	v.literal("manual")
);

export const dealLockFeeCollectionStatusValidator = v.union(
	v.literal("not_required"),
	v.literal("pending"),
	v.literal("collected"),
	v.literal("failed"),
	v.literal("refund_needed"),
	v.literal("refunded")
);

export const startDealLockCheckoutArgsValidator = {
	fractionalShareUnits: v.number(),
	idempotencyKey: v.optional(v.string()),
	listingId: v.id("listings"),
	portalId: v.id("portals"),
	selectedLawyerAuthId: v.optional(v.string()),
	selectedLawyerType: v.optional(dealLockSelectedLawyerTypeValidator),
};
