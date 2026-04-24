import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getLenderByAuthId } from "../auth/actorResolution";
import { convex } from "../fluent";
import { getAccountLenderId } from "../ledger/accountOwnership";
import { getAvailableBalance } from "../ledger/accounts";
import {
	reserveSharesHandler,
	voidReservationHandler,
} from "../ledger/mutations";
import { matchesMarketplaceFilters } from "../listings/marketplace";
import {
	clampMarketplaceFiltersToLenderConstraints,
	resolveViewerLenderConstraintForPortal,
} from "../listings/portalVisibility";
import {
	assertCheckoutTransitionAllowed,
	isActiveCheckoutStatus,
} from "./status";
import {
	assertPositiveWholeFractions,
	buildCheckoutIdempotencyKey,
	CHECKOUT_SESSION_TTL_MS,
	checkoutFailure,
	type StartMarketplaceCheckoutResult,
} from "./types";
import {
	CHECKOUT_LOCK_FEE_AMOUNT_CENTS,
	CHECKOUT_LOCK_FEE_CURRENCY,
	parseSelectedLawyerSnapshot,
	selectedLawyerSnapshotValidator,
} from "./validators";

type CheckoutSessionDoc = Doc<"checkoutSessions">;
type LedgerAccountDoc = Doc<"ledger_accounts">;
type LenderDoc = Doc<"lenders">;
type ListingDoc = Doc<"listings">;
type ProductionListingDoc = ListingDoc & { mortgageId: Id<"mortgages"> };

const checkoutSource = (actor: string) =>
	({
		type: "user" as const,
		actor,
		channel: "marketplace_checkout",
	}) as const;

const today = () => new Date().toISOString().slice(0, 10);

const activeCheckoutStatuses = [
	"preparing_provider_session",
	"hosted_checkout_open",
	"payment_failed_retryable",
] as const;

const prepareMarketplaceCheckoutArgsValidator = {
	listingId: v.id("listings"),
	portalId: v.id("portals"),
	requestedFractions: v.number(),
	selectedLawyer: selectedLawyerSnapshotValidator,
	viewerAuthId: v.string(),
	viewerIsFairLendAdmin: v.boolean(),
};

const attachProviderSessionArgsValidator = {
	checkoutSessionId: v.id("checkoutSessions"),
	stripeCheckoutSessionId: v.string(),
	stripePaymentIntentId: v.optional(v.string()),
	now: v.optional(v.number()),
};

const markProviderStartFailedArgsValidator = {
	checkoutSessionId: v.id("checkoutSessions"),
	failureReason: v.string(),
	now: v.optional(v.number()),
};

function isSameActiveCheckout(
	session: CheckoutSessionDoc,
	args: {
		lenderId: Id<"lenders">;
		portalId: Id<"portals">;
		requestedFractions: number;
		now: number;
		selectedLawyer: CheckoutSessionDoc["selectedLawyer"];
	}
): boolean {
	return (
		session.lenderId === args.lenderId &&
		session.portalId === args.portalId &&
		session.requestedFractions === args.requestedFractions &&
		sameSelectedLawyer(session.selectedLawyer, args.selectedLawyer) &&
		session.expiresAt > args.now &&
		isActiveCheckoutStatus(session.status)
	);
}

function sameSelectedLawyer(
	left: CheckoutSessionDoc["selectedLawyer"],
	right: CheckoutSessionDoc["selectedLawyer"]
): boolean {
	return (
		left.type === right.type &&
		left.name === right.name &&
		left.email === right.email &&
		left.firm === right.firm &&
		(left.type === "platform_lawyer" ? left.lawyerId : undefined) ===
			(right.type === "platform_lawyer" ? right.lawyerId : undefined)
	);
}

async function findActiveCheckoutSession(
	ctx: MutationCtx,
	args: {
		lenderId: Id<"lenders">;
		listingId: Id<"listings">;
		now: number;
		portalId: Id<"portals">;
		requestedFractions: number;
		selectedLawyer: CheckoutSessionDoc["selectedLawyer"];
	}
): Promise<CheckoutSessionDoc | null> {
	for (const status of activeCheckoutStatuses) {
		const sessions = await ctx.db
			.query("checkoutSessions")
			.withIndex("by_listing_status", (q) =>
				q.eq("listingId", args.listingId).eq("status", status)
			)
			.collect();
		const matching = sessions.find((session) =>
			isSameActiveCheckout(session, args)
		);
		if (matching) {
			return matching;
		}
	}
	return null;
}

function checkoutPrepared(session: CheckoutSessionDoc) {
	return {
		ok: true as const,
		checkoutSessionId: session._id,
		expiresAt: session.expiresAt,
		idempotencyKey: session.idempotencyKey,
		lenderAuthId: session.lenderAuthId,
		lenderId: session.lenderId,
		listingId: session.listingId,
		mortgageId: session.mortgageId,
		portalId: session.portalId,
		requestedFractions: session.requestedFractions,
		reservationId: session.reservationId,
		selectedLawyer: session.selectedLawyer,
	};
}

function assertListingAvailableForCheckout(
	listing: ListingDoc | null
): ProductionListingDoc | StartMarketplaceCheckoutResult {
	if (!listing || listing.status !== "published") {
		return checkoutFailure("listing_unavailable", "Listing is unavailable");
	}
	if (listing.dataSource !== "mortgage_pipeline" || !listing.mortgageId) {
		return checkoutFailure(
			"demo_listing_not_supported",
			"Demo listings are not supported for hosted checkout"
		);
	}
	return listing as ProductionListingDoc;
}

function isFailureResult(
	value: ListingDoc | StartMarketplaceCheckoutResult
): value is StartMarketplaceCheckoutResult {
	return "ok" in value;
}

function resolveLedgerLenderId(lender: LenderDoc): string {
	return String(lender._id);
}

async function resolveSellerAccount(
	ctx: MutationCtx,
	args: {
		buyerLedgerLenderId: string;
		mortgageId: Id<"mortgages">;
		requestedFractions: number;
	}
): Promise<LedgerAccountDoc | null> {
	const accounts = await ctx.db
		.query("ledger_accounts")
		.withIndex("by_type_and_mortgage", (q) =>
			q.eq("type", "POSITION").eq("mortgageId", String(args.mortgageId))
		)
		.collect();

	const candidates = accounts
		.map((account) => ({
			account,
			availableBalance: getAvailableBalance(account),
			lenderId: getAccountLenderId(account),
		}))
		.filter(
			(
				candidate
			): candidate is {
				account: LedgerAccountDoc;
				availableBalance: bigint;
				lenderId: string;
			} =>
				candidate.lenderId !== undefined &&
				candidate.lenderId !== args.buyerLedgerLenderId &&
				candidate.availableBalance >= BigInt(args.requestedFractions)
		)
		.sort((left, right) => {
			if (left.availableBalance !== right.availableBalance) {
				return left.availableBalance > right.availableBalance ? -1 : 1;
			}
			return String(left.account._id).localeCompare(String(right.account._id));
		});

	return candidates[0]?.account ?? null;
}

export const prepareMarketplaceCheckout = convex
	.mutation()
	.input(prepareMarketplaceCheckoutArgsValidator)
	.handler(async (ctx, args) => {
		const now = Date.now();
		let requestedFractions: number;
		let selectedLawyer: CheckoutSessionDoc["selectedLawyer"];
		try {
			requestedFractions = assertPositiveWholeFractions(
				args.requestedFractions
			);
		} catch (error) {
			return checkoutFailure(
				"insufficient_fractions",
				error instanceof Error ? error.message : "Invalid fractions"
			);
		}
		try {
			selectedLawyer = parseSelectedLawyerSnapshot(args.selectedLawyer);
		} catch (error) {
			return checkoutFailure(
				"invalid_lawyer",
				error instanceof Error ? error.message : "Invalid lawyer"
			);
		}

		const lender = await getLenderByAuthId(ctx, args.viewerAuthId);
		if (!lender) {
			return checkoutFailure("unauthorized", "Lender profile is required");
		}

		const listingCheck = assertListingAvailableForCheckout(
			await ctx.db.get(args.listingId)
		);
		if (isFailureResult(listingCheck)) {
			return listingCheck;
		}

		let lenderConstraint: Awaited<
			ReturnType<typeof resolveViewerLenderConstraintForPortal>
		>;
		try {
			lenderConstraint = await resolveViewerLenderConstraintForPortal(ctx, {
				portalId: args.portalId,
				viewerAuthId: args.viewerAuthId,
				viewerIsFairLendAdmin: args.viewerIsFairLendAdmin,
			});
		} catch {
			return checkoutFailure(
				"listing_unavailable",
				"Listing is unavailable in this portal"
			);
		}

		const visibilityFilters = clampMarketplaceFiltersToLenderConstraints(
			undefined,
			lenderConstraint
		);
		if (!matchesMarketplaceFilters(listingCheck, visibilityFilters)) {
			return checkoutFailure(
				"listing_unavailable",
				"Listing is unavailable in this portal"
			);
		}

		const activeCheckout = await findActiveCheckoutSession(ctx, {
			lenderId: lender._id,
			listingId: listingCheck._id,
			now,
			portalId: args.portalId,
			requestedFractions,
			selectedLawyer,
		});
		if (activeCheckout) {
			return checkoutPrepared(activeCheckout);
		}

		const buyerLedgerLenderId = resolveLedgerLenderId(lender);
		const sellerAccount = await resolveSellerAccount(ctx, {
			buyerLedgerLenderId,
			mortgageId: listingCheck.mortgageId,
			requestedFractions,
		});
		const sellerLedgerLenderId = sellerAccount
			? getAccountLenderId(sellerAccount)
			: undefined;
		if (!(sellerAccount && sellerLedgerLenderId)) {
			return checkoutFailure(
				"insufficient_fractions",
				"Insufficient fractions are available"
			);
		}

		let reservationId: Id<"ledger_reservations">;
		try {
			const reservation = await reserveSharesHandler(ctx, {
				mortgageId: String(listingCheck.mortgageId),
				sellerLenderId: sellerLedgerLenderId,
				buyerLenderId: buyerLedgerLenderId,
				amount: requestedFractions,
				effectiveDate: today(),
				idempotencyKey: `marketplace-checkout-reservation:${String(
					listingCheck._id
				)}:${String(lender._id)}:${String(now)}`,
				source: checkoutSource(args.viewerAuthId),
				metadata: {
					listingId: String(listingCheck._id),
					portalId: String(args.portalId),
					selectedLawyerType: selectedLawyer.type,
				},
			});
			reservationId = reservation.reservationId;
		} catch {
			return checkoutFailure(
				"insufficient_fractions",
				"Insufficient fractions are available"
			);
		}

		const startedAt = now;
		const reservationDoc = await ctx.db.get(reservationId);
		if (!reservationDoc) {
			throw new ConvexError("Reservation missing after checkout prepare");
		}

		const checkoutSessionId = await ctx.db.insert("checkoutSessions", {
			status: "preparing_provider_session",
			listingId: listingCheck._id,
			mortgageId: listingCheck.mortgageId,
			portalId: args.portalId,
			lenderId: lender._id,
			lenderAuthId: args.viewerAuthId,
			sellerAccountId: sellerAccount._id,
			buyerAccountId: reservationDoc.buyerAccountId,
			reservationId,
			requestedFractions,
			lockFeeAmount: CHECKOUT_LOCK_FEE_AMOUNT_CENTS,
			lockFeeCurrency: CHECKOUT_LOCK_FEE_CURRENCY,
			selectedLawyer,
			startedAt,
			expiresAt: startedAt + CHECKOUT_SESSION_TTL_MS,
			idempotencyKey: "pending",
			createdBy: args.viewerAuthId,
			updatedAt: startedAt,
		});
		const checkoutSession = await ctx.db.get(checkoutSessionId);
		if (!checkoutSession) {
			throw new ConvexError("Failed to create checkout session");
		}
		const idempotencyKey = buildCheckoutIdempotencyKey(checkoutSessionId);
		await ctx.db.patch(checkoutSessionId, {
			idempotencyKey,
			updatedAt: Date.now(),
		});

		return checkoutPrepared({
			...checkoutSession,
			idempotencyKey,
		});
	})
	.internal();

export const attachProviderSession = convex
	.mutation()
	.input(attachProviderSessionArgsValidator)
	.handler(async (ctx, args) => {
		const now = args.now ?? Date.now();
		const checkoutSession = await ctx.db.get(args.checkoutSessionId);
		if (!checkoutSession) {
			throw new ConvexError("Checkout session not found");
		}

		if (checkoutSession.status === "hosted_checkout_open") {
			if (
				checkoutSession.stripeCheckoutSessionId !== args.stripeCheckoutSessionId
			) {
				throw new ConvexError("Checkout provider session mismatch");
			}
			return checkoutPrepared(checkoutSession);
		}

		assertCheckoutTransitionAllowed(
			checkoutSession.status,
			"hosted_checkout_open"
		);

		await ctx.db.patch(checkoutSession._id, {
			status: "hosted_checkout_open",
			stripeCheckoutSessionId: args.stripeCheckoutSessionId,
			...(args.stripePaymentIntentId
				? { stripePaymentIntentId: args.stripePaymentIntentId }
				: {}),
			updatedAt: now,
		});

		const updated = await ctx.db.get(checkoutSession._id);
		if (!updated) {
			throw new ConvexError("Checkout session missing after provider attach");
		}
		return checkoutPrepared(updated);
	})
	.internal();

export const markProviderStartFailed = convex
	.mutation()
	.input(markProviderStartFailedArgsValidator)
	.handler(async (ctx, args) => {
		const now = args.now ?? Date.now();
		const checkoutSession = await ctx.db.get(args.checkoutSessionId);
		if (!checkoutSession) {
			throw new ConvexError("Checkout session not found");
		}
		if (checkoutSession.status === "provider_start_failed") {
			return checkoutPrepared(checkoutSession);
		}
		if (checkoutSession.status !== "preparing_provider_session") {
			assertCheckoutTransitionAllowed(
				checkoutSession.status,
				"provider_start_failed"
			);
		}

		const reservation = await ctx.db.get(checkoutSession.reservationId);
		if (reservation?.status === "pending") {
			await voidReservationHandler(ctx, {
				reservationId: checkoutSession.reservationId,
				effectiveDate: today(),
				idempotencyKey: `marketplace-checkout-provider-failed:${String(
					checkoutSession._id
				)}`,
				reason: args.failureReason,
				source: checkoutSource(checkoutSession.createdBy),
			});
		}

		await ctx.db.patch(checkoutSession._id, {
			status: "provider_start_failed",
			failureReason: args.failureReason,
			resolvedAt: now,
			updatedAt: now,
		});

		const updated = await ctx.db.get(checkoutSession._id);
		if (!updated) {
			throw new ConvexError("Checkout session missing after compensation");
		}
		return checkoutPrepared(updated);
	})
	.internal();
