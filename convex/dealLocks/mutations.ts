import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";
import { grantDealAccess } from "../deals/mutations";
import { executeTransition } from "../engine/transition";
import type { CommandSource } from "../engine/types";
import {
	reserveSharesHandler,
	voidReservationHandler,
} from "../ledger/reservations";
import { unixMsToBusinessDate } from "../lib/businessDates";
import { matchesMarketplaceFilters } from "../listings/marketplace";
import {
	clampMarketplaceFiltersToLenderConstraints,
	resolveViewerLenderConstraintForPortal,
} from "../listings/portalVisibility";
import { resolveSellerLotForReservation } from "../marketplace/saleInventory";
import {
	DEAL_LOCK_CHECKOUT_TIMEOUT_MS,
	DEAL_LOCK_FEE_AMOUNT_CENTS,
	DEAL_LOCK_FEE_CURRENCY,
	dealLockSelectedLawyerTypeValidator,
} from "./validators";

const DEFAULT_EXPIRE_STALE_LIMIT = 50;

function ensureSafeFractionUnits(units: number) {
	if (!(Number.isSafeInteger(units) && units > 0 && units <= 10_000)) {
		throw new ConvexError({
			code: "INVALID_FRACTION_UNITS" as const,
			message: "Fraction units must be an integer between 1 and 10000",
		});
	}
}

function isReusableCheckoutSession(
	session: Doc<"dealLockCheckoutSessions">,
	now: number
) {
	return session.status === "created" && session.expiresAt > now;
}

function isEligibleBuyerLender(lender: Doc<"lenders">) {
	return (
		lender.status === "active" &&
		(lender.accreditationStatus === "accredited" ||
			lender.accreditationStatus === "exempt")
	);
}

async function getReusableCheckoutSession(
	ctx: MutationCtx,
	args: {
		buyerAuthId: string;
		fractionalShareUnits: number;
		listingId: Id<"listings">;
		now: number;
		selectedLawyerAuthId?: string;
		selectedLawyerType?: Doc<"dealLockCheckoutSessions">["selectedLawyerType"];
	}
) {
	const sessions = await ctx.db
		.query("dealLockCheckoutSessions")
		.withIndex("by_listing_buyer_status", (q) =>
			q
				.eq("listingId", args.listingId)
				.eq("buyerAuthId", args.buyerAuthId)
				.eq("status", "created")
		)
		.collect();
	return (
		sessions.find(
			(session) =>
				isReusableCheckoutSession(session, args.now) &&
				session.fractionalShareUnits === args.fractionalShareUnits &&
				session.selectedLawyerAuthId === args.selectedLawyerAuthId &&
				session.selectedLawyerType === args.selectedLawyerType
		) ?? null
	);
}

async function ensureListingVisibleForCheckout(
	ctx: MutationCtx,
	args: {
		buyerAuthId: string;
		listing: Doc<"listings">;
		portalId?: Id<"portals">;
		viewerIsFairLendAdmin?: boolean;
	}
) {
	if (!args.portalId) {
		return;
	}
	const lenderConstraint = await resolveViewerLenderConstraintForPortal(ctx, {
		portalId: args.portalId,
		viewerAuthId: args.buyerAuthId,
		viewerIsFairLendAdmin: args.viewerIsFairLendAdmin ?? false,
	});
	const visibilityFilters = clampMarketplaceFiltersToLenderConstraints(
		undefined,
		lenderConstraint
	);
	if (!matchesMarketplaceFilters(args.listing, visibilityFilters)) {
		throw new ConvexError({
			code: "LISTING_NOT_VISIBLE" as const,
			message: "Listing is not visible to the current portal viewer",
		});
	}
}

async function ensureAssignedCheckoutLawyer(
	ctx: MutationCtx,
	args: {
		mortgageId: Id<"mortgages">;
		selectedLawyerAuthId: string;
	}
) {
	const assignments = await ctx.db
		.query("closingTeamAssignments")
		.withIndex("by_mortgage", (q) => q.eq("mortgageId", args.mortgageId))
		.collect();
	const assigned = assignments.some(
		(assignment) =>
			assignment.userId === args.selectedLawyerAuthId &&
			(assignment.role === "closing_lawyer" ||
				assignment.role === "reviewing_lawyer")
	);
	if (!assigned) {
		throw new ConvexError({
			code: "LAWYER_NOT_ASSIGNED" as const,
			message: "Selected lawyer is not assigned to this listing mortgage",
		});
	}
}

async function markLateSuccessRefundNeeded(
	ctx: MutationCtx,
	args: {
		now: number;
		providerEventId: string;
		session: Doc<"dealLockCheckoutSessions">;
		stripePaymentIntentId?: string;
		stripePaymentStatus?: string;
	}
) {
	if (args.session.status === "created" && args.session.reservationId) {
		await voidReservationHandler(ctx, {
			effectiveDate: unixMsToBusinessDate(args.now),
			idempotencyKey: `deal-lock:${args.session.idempotencyKey}:late-success:void`,
			reason: "Stripe checkout succeeded after FairLend session expiry",
			reservationId: args.session.reservationId,
			source: {
				actor: args.session.buyerAuthId,
				channel: "api_webhook",
				type: "webhook",
			},
		});
	}
	await ctx.db.patch(args.session._id, {
		expiredAt: args.session.expiredAt ?? args.now,
		providerEventId: args.providerEventId,
		refundStatus: "needed",
		status: "expired",
		stripePaymentIntentId: args.stripePaymentIntentId,
		stripePaymentStatus: args.stripePaymentStatus,
		updatedAt: args.now,
	});
	return {
		outcome: "late_success_refund_needed" as const,
		sessionId: args.session._id,
	};
}

async function expireCreatedCheckoutSession(
	ctx: MutationCtx,
	sessionId: Id<"dealLockCheckoutSessions">
) {
	const session = await ctx.db.get(sessionId);
	if (!session || session.status !== "created") {
		return session;
	}
	const now = Date.now();
	if (session.reservationId) {
		await voidReservationHandler(ctx, {
			effectiveDate: unixMsToBusinessDate(now),
			idempotencyKey: `deal-lock:${session.idempotencyKey}:expired:void`,
			reason: "Deal lock checkout session expired",
			reservationId: session.reservationId,
			source: {
				actor: session.buyerAuthId,
				channel: "marketplace_listing_lock",
				type: "system",
			},
		});
	}
	await ctx.db.patch(sessionId, {
		expiredAt: now,
		status: "expired",
		updatedAt: now,
	});
	return await ctx.db.get(sessionId);
}

export const getSessionByStripeCheckoutSessionId = internalQuery({
	args: { stripeCheckoutSessionId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("dealLockCheckoutSessions")
			.withIndex("by_stripe_checkout_session", (q) =>
				q.eq("stripeCheckoutSessionId", args.stripeCheckoutSessionId)
			)
			.first();
	},
});

export const prepareCheckoutSession = internalMutation({
	args: {
		buyerAuthId: v.string(),
		fractionalShareUnits: v.number(),
		idempotencyKey: v.string(),
		listingId: v.id("listings"),
		portalId: v.optional(v.id("portals")),
		selectedLawyerAuthId: v.optional(v.string()),
		selectedLawyerType: v.optional(dealLockSelectedLawyerTypeValidator),
		viewerIsFairLendAdmin: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		ensureSafeFractionUnits(args.fractionalShareUnits);
		const now = Date.now();

		const listing = await ctx.db.get(args.listingId);
		if (!listing || listing.status !== "published") {
			throw new ConvexError({
				code: "LISTING_NOT_AVAILABLE" as const,
				message: "Listing is not available for checkout",
			});
		}
		if (!listing.mortgageId) {
			throw new ConvexError({
				code: "LISTING_MORTGAGE_MISSING" as const,
				message: "Listing is missing mortgage linkage",
			});
		}
		await ensureListingVisibleForCheckout(ctx, {
			buyerAuthId: args.buyerAuthId,
			listing,
			portalId: args.portalId,
			viewerIsFairLendAdmin: args.viewerIsFairLendAdmin,
		});

		const mortgage = await ctx.db.get(listing.mortgageId);
		if (!mortgage) {
			throw new ConvexError({
				code: "MORTGAGE_NOT_FOUND" as const,
				message: "Listing mortgage could not be found",
			});
		}

		const buyerUser = await ctx.db
			.query("users")
			.withIndex("authId", (q) => q.eq("authId", args.buyerAuthId))
			.unique();
		if (!buyerUser) {
			throw new ConvexError({
				code: "BUYER_NOT_FOUND" as const,
				message: "Authenticated buyer user could not be resolved",
			});
		}
		const buyerLender = await ctx.db
			.query("lenders")
			.withIndex("by_user", (q) => q.eq("userId", buyerUser._id))
			.first();
		if (!buyerLender) {
			throw new ConvexError({
				code: "BUYER_LENDER_NOT_FOUND" as const,
				message: "Authenticated buyer does not have a lender profile",
			});
		}
		if (!isEligibleBuyerLender(buyerLender)) {
			throw new ConvexError({
				code: "BUYER_LENDER_NOT_ELIGIBLE" as const,
				message: "Authenticated buyer lender profile is not eligible to invest",
			});
		}

		if (!(args.selectedLawyerAuthId && args.selectedLawyerType)) {
			throw new ConvexError({
				code: "LAWYER_REQUIRED" as const,
				message: "A valid lawyer selection is required before checkout",
			});
		}
		const selectedLawyerAuthId = args.selectedLawyerAuthId;
		const lawyerUser = await ctx.db
			.query("users")
			.withIndex("authId", (q) => q.eq("authId", selectedLawyerAuthId))
			.unique();
		if (!lawyerUser) {
			throw new ConvexError({
				code: "LAWYER_NOT_FOUND" as const,
				message: "Selected lawyer could not be resolved",
			});
		}
		await ensureAssignedCheckoutLawyer(ctx, {
			mortgageId: listing.mortgageId,
			selectedLawyerAuthId,
		});

		const reusable = await getReusableCheckoutSession(ctx, {
			buyerAuthId: args.buyerAuthId,
			fractionalShareUnits: args.fractionalShareUnits,
			listingId: args.listingId,
			now,
			selectedLawyerAuthId: args.selectedLawyerAuthId,
			selectedLawyerType: args.selectedLawyerType,
		});
		if (reusable) {
			return reusable;
		}

		const existing = await ctx.db
			.query("dealLockCheckoutSessions")
			.withIndex("by_idempotency", (q) =>
				q.eq("idempotencyKey", args.idempotencyKey)
			)
			.first();
		if (existing && isReusableCheckoutSession(existing, now)) {
			return existing;
		}

		const persistedIdempotencyKey = existing
			? `${args.idempotencyKey}:retry:${String(now)}`
			: args.idempotencyKey;
		const seller = await resolveSellerLotForReservation(ctx, {
			actorAuthId: args.buyerAuthId,
			effectiveDate: unixMsToBusinessDate(now),
			idempotencyKey: `deal-lock:${persistedIdempotencyKey}`,
			mortgageId: listing.mortgageId,
			requestedLedgerUnits: args.fractionalShareUnits,
		});
		if (!seller) {
			throw new ConvexError({
				code: "SELLER_POSITION_NOT_FOUND" as const,
				message: "Listing does not have a seller position available to reserve",
			});
		}

		const reservation = await reserveSharesHandler(ctx, {
			amount: args.fractionalShareUnits,
			buyerLenderId: args.buyerAuthId,
			effectiveDate: unixMsToBusinessDate(now),
			idempotencyKey: `deal-lock:${persistedIdempotencyKey}:reserve`,
			metadata: {
				buyerAuthId: args.buyerAuthId,
				listingId: String(args.listingId),
				selectedLawyerAuthId,
				selectedLawyerType: args.selectedLawyerType,
			},
			mortgageId: String(listing.mortgageId),
			sellerLenderId: seller.lenderId,
			source: {
				actor: args.buyerAuthId,
				channel: "marketplace_listing_lock",
				type: "user",
			},
		});

		const sessionId = await ctx.db.insert("dealLockCheckoutSessions", {
			buyerAuthId: args.buyerAuthId,
			createdAt: now,
			expiresAt: now + DEAL_LOCK_CHECKOUT_TIMEOUT_MS,
			fractionalShareUnits: args.fractionalShareUnits,
			idempotencyKey: persistedIdempotencyKey,
			listingId: args.listingId,
			lockFeeAmountCents: DEAL_LOCK_FEE_AMOUNT_CENTS,
			lockFeeCurrency: DEAL_LOCK_FEE_CURRENCY,
			mortgageId: listing.mortgageId,
			purchasingLenderAuthId: args.buyerAuthId,
			refundStatus: "none",
			reservationId: reservation.reservationId,
			selectedLawyerAuthId,
			selectedLawyerType: args.selectedLawyerType,
			sellerAuthId: seller.lenderId,
			sellingLenderAuthId: seller.lenderId,
			status: "created",
			updatedAt: now,
		});
		const session = await ctx.db.get(sessionId);
		if (!session) {
			throw new ConvexError("CHECKOUT_SESSION_INSERT_FAILED");
		}
		return session;
	},
});

export const attachStripeCheckoutSession = internalMutation({
	args: {
		checkoutSessionId: v.id("dealLockCheckoutSessions"),
		stripeCheckoutSessionId: v.string(),
		stripeCheckoutUrl: v.string(),
	},
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.checkoutSessionId);
		if (!session) {
			throw new ConvexError("CHECKOUT_SESSION_NOT_FOUND");
		}
		await ctx.db.patch(args.checkoutSessionId, {
			stripeCheckoutSessionId: args.stripeCheckoutSessionId,
			stripeCheckoutUrl: args.stripeCheckoutUrl,
			updatedAt: Date.now(),
		});
		return await ctx.db.get(args.checkoutSessionId);
	},
});

export const markCheckoutSessionFailed = internalMutation({
	args: {
		checkoutSessionId: v.id("dealLockCheckoutSessions"),
		failureReason: v.string(),
	},
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.checkoutSessionId);
		if (!session || session.status !== "created") {
			return session;
		}
		const now = Date.now();
		if (session.reservationId) {
			await voidReservationHandler(ctx, {
				effectiveDate: unixMsToBusinessDate(now),
				idempotencyKey: `deal-lock:${session.idempotencyKey}:failed:void`,
				reason: args.failureReason,
				reservationId: session.reservationId,
				source: {
					actor: session.buyerAuthId,
					channel: "marketplace_listing_lock",
					type: "system",
				},
			});
		}
		await ctx.db.patch(args.checkoutSessionId, {
			failedAt: now,
			failureReason: args.failureReason,
			status: "failed",
			updatedAt: now,
		});
		return await ctx.db.get(args.checkoutSessionId);
	},
});

export const markCheckoutSessionExpired = internalMutation({
	args: { checkoutSessionId: v.id("dealLockCheckoutSessions") },
	handler: async (ctx, args) => {
		return expireCreatedCheckoutSession(ctx, args.checkoutSessionId);
	},
});

export const expireStaleCheckoutSessions = internalMutation({
	args: {
		asOf: v.optional(v.number()),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const asOf = args.asOf ?? Date.now();
		const limit = Math.max(
			1,
			Math.min(
				args.limit ?? DEFAULT_EXPIRE_STALE_LIMIT,
				DEFAULT_EXPIRE_STALE_LIMIT
			)
		);
		const sessions = await ctx.db
			.query("dealLockCheckoutSessions")
			.withIndex("by_status_expires_at", (q) =>
				q.eq("status", "created").lte("expiresAt", asOf)
			)
			.take(limit);
		let expiredCount = 0;
		for (const session of sessions) {
			const expired = await expireCreatedCheckoutSession(ctx, session._id);
			if (expired?.status === "expired") {
				expiredCount += 1;
			}
		}
		return {
			expiredCount,
			scannedCount: sessions.length,
		};
	},
});

export const getCheckoutSessionInternal = internalQuery({
	args: { checkoutSessionId: v.id("dealLockCheckoutSessions") },
	handler: async (ctx, args) => ctx.db.get(args.checkoutSessionId),
});

export const processStripeCheckoutSuccess = internalMutation({
	args: {
		providerEventId: v.string(),
		stripeCheckoutSessionId: v.string(),
		stripePaymentIntentId: v.optional(v.string()),
		stripePaymentStatus: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const session = await ctx.db
			.query("dealLockCheckoutSessions")
			.withIndex("by_stripe_checkout_session", (q) =>
				q.eq("stripeCheckoutSessionId", args.stripeCheckoutSessionId)
			)
			.first();
		if (!session) {
			return {
				outcome: "unknown_session" as const,
				stripeCheckoutSessionId: args.stripeCheckoutSessionId,
			};
		}
		if (session.dealId) {
			return {
				dealId: session.dealId,
				outcome: "duplicate_success" as const,
				sessionId: session._id,
			};
		}
		if (args.stripePaymentStatus !== "paid") {
			throw new ConvexError({
				code: "CHECKOUT_PAYMENT_NOT_PAID" as const,
				message: "Stripe checkout session is not paid",
				stripePaymentStatus: args.stripePaymentStatus,
			});
		}
		const now = Date.now();
		if (session.status === "expired") {
			return await markLateSuccessRefundNeeded(ctx, {
				now,
				providerEventId: args.providerEventId,
				session,
				stripePaymentIntentId: args.stripePaymentIntentId,
				stripePaymentStatus: args.stripePaymentStatus,
			});
		}
		if (session.status !== "created") {
			return {
				outcome: "terminal_session" as const,
				sessionId: session._id,
				status: session.status,
			};
		}

		if (now > session.expiresAt) {
			return await markLateSuccessRefundNeeded(ctx, {
				now,
				providerEventId: args.providerEventId,
				session,
				stripePaymentIntentId: args.stripePaymentIntentId,
				stripePaymentStatus: args.stripePaymentStatus,
			});
		}

		if (!(session.reservationId && session.selectedLawyerAuthId)) {
			throw new ConvexError({
				code: "CHECKOUT_SESSION_INCOMPLETE" as const,
				message: "Checkout session is missing reservation or lawyer context",
			});
		}

		const dealId = await ctx.db.insert("deals", {
			buyerId: session.buyerAuthId,
			createdAt: now,
			createdBy: `stripe:${args.providerEventId}`,
			dealLockCheckoutSessionId: session._id,
			fractionalShare: session.fractionalShareUnits,
			lawyerId: session.selectedLawyerAuthId,
			lawyerType: session.selectedLawyerType,
			lockFeeCollectionProvider: "stripe_checkout",
			lockFeeCollectionStatus: "collected",
			lockingFeeAmount: session.lockFeeAmountCents,
			mortgageId: session.mortgageId,
			purchasingLenderAuthId: session.buyerAuthId,
			reservationId: session.reservationId,
			sellerId: session.sellerAuthId,
			sellingLenderAuthId: session.sellerAuthId,
			status: "initiated",
			stripeCheckoutSessionId: args.stripeCheckoutSessionId,
			stripePaymentIntentId: args.stripePaymentIntentId,
			stripePaymentStatus: args.stripePaymentStatus,
		});

		await ctx.db.patch(session.reservationId, { dealId: String(dealId) });
		await grantDealAccess(ctx.db, {
			dealId,
			grantedBy: "stripe_webhook",
			role: "lender",
			userId: session.buyerAuthId,
		});
		await grantDealAccess(ctx.db, {
			dealId,
			grantedBy: "stripe_webhook",
			role: "lender",
			userId: session.sellerAuthId,
		});
		if (session.selectedLawyerType) {
			await grantDealAccess(ctx.db, {
				dealId,
				grantedBy: "stripe_webhook",
				role: session.selectedLawyerType,
				userId: session.selectedLawyerAuthId,
			});
		}

		const source: CommandSource = {
			actorId: "stripe",
			actorType: "system",
			channel: "api_webhook",
		};
		const transition = await executeTransition(ctx, {
			entityId: dealId,
			entityType: "deal",
			eventType: "DEAL_LOCKED",
			payload: { closingDate: now },
			source,
		});

		await ctx.db.patch(session._id, {
			dealCreatedAt: now,
			dealId,
			paidAt: now,
			providerEventId: args.providerEventId,
			status: "paid",
			stripePaymentIntentId: args.stripePaymentIntentId,
			stripePaymentStatus: args.stripePaymentStatus,
			updatedAt: now,
		});

		return {
			dealId,
			outcome: "deal_created" as const,
			sessionId: session._id,
			transition,
		};
	},
});

export type PreparedCheckoutSessionId = Id<"dealLockCheckoutSessions">;
