import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { auditLog } from "../auditLog";
import { convex } from "../fluent";

export interface ListingPublicationStatus {
	readonly canPublish: boolean;
	readonly isPublished: boolean;
	readonly listingId: Id<"listings">;
	readonly mortgageId: Id<"mortgages"> | null;
	readonly publishedAt: number | null;
	readonly status: Doc<"listings">["status"];
	readonly title: string | null;
}

export interface PublishListingResult {
	readonly publication: ListingPublicationStatus;
	readonly wasAlreadyPublished: boolean;
}

export interface HideListingResult {
	readonly publication: ListingPublicationStatus;
	readonly wasAlreadyHidden: boolean;
}

export function toListingPublicationStatus(
	listing: Doc<"listings">
): ListingPublicationStatus {
	return {
		canPublish: listing.status === "draft",
		isPublished: listing.status === "published",
		listingId: listing._id,
		mortgageId: listing.mortgageId ?? null,
		publishedAt: listing.publishedAt ?? null,
		status: listing.status,
		title: listing.title ?? null,
	};
}

export async function readListingPublicationStatus(
	ctx: Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">,
	listingId: Id<"listings">
) {
	const listing = await ctx.db.get(listingId);
	return listing ? toListingPublicationStatus(listing) : null;
}

export async function publishListingRecord(
	ctx: MutationCtx,
	args: {
		actorAuthId: string;
		listingId: Id<"listings">;
		now: number;
	}
): Promise<PublishListingResult> {
	const listing = await ctx.db.get(args.listingId);
	if (!listing) {
		throw new ConvexError("Listing not found");
	}
	if (listing.status === "delisted") {
		throw new ConvexError("Delisted listings cannot be published again");
	}
	if (listing.status === "published") {
		return {
			publication: toListingPublicationStatus(listing),
			wasAlreadyPublished: true,
		};
	}

	await ctx.db.patch(args.listingId, {
		delistReason: undefined,
		delistedAt: undefined,
		lastTransitionAt: args.now,
		publishedAt: listing.publishedAt ?? args.now,
		status: "published",
		updatedAt: args.now,
	});

	const updatedListing = await ctx.db.get(args.listingId);
	if (!updatedListing) {
		throw new ConvexError("Listing disappeared during publish");
	}

	await auditLog.log(ctx, {
		action: "listing.published",
		actorId: args.actorAuthId,
		metadata: {
			listingId: String(updatedListing._id),
			mortgageId: updatedListing.mortgageId
				? String(updatedListing.mortgageId)
				: null,
			publishedAt: updatedListing.publishedAt ?? args.now,
			previousStatus: listing.status,
		},
		resourceId: updatedListing._id,
		resourceType: "listings",
		severity: "info",
	});

	return {
		publication: toListingPublicationStatus(updatedListing),
		wasAlreadyPublished: false,
	};
}

export async function hideListingRecord(
	ctx: MutationCtx,
	args: {
		actorAuthId: string;
		listingId: Id<"listings">;
		now: number;
	}
): Promise<HideListingResult> {
	const listing = await ctx.db.get(args.listingId);
	if (!listing) {
		throw new ConvexError("Listing not found");
	}
	if (listing.status === "draft") {
		return {
			publication: toListingPublicationStatus(listing),
			wasAlreadyHidden: true,
		};
	}

	await ctx.db.patch(args.listingId, {
		delistReason: undefined,
		delistedAt: undefined,
		lastTransitionAt: args.now,
		status: "draft",
		updatedAt: args.now,
	});

	const updatedListing = await ctx.db.get(args.listingId);
	if (!updatedListing) {
		throw new ConvexError("Listing disappeared during hide");
	}

	await auditLog.log(ctx, {
		action: "listing.hidden",
		actorId: args.actorAuthId,
		metadata: {
			listingId: String(updatedListing._id),
			mortgageId: updatedListing.mortgageId
				? String(updatedListing.mortgageId)
				: null,
			previousStatus: listing.status,
		},
		resourceId: updatedListing._id,
		resourceType: "listings",
		severity: "info",
	});

	return {
		publication: toListingPublicationStatus(updatedListing),
		wasAlreadyHidden: false,
	};
}

export const getListingPublicationStatusInternal = convex
	.query()
	.input({
		listingId: v.id("listings"),
	})
	.handler(async (ctx, args) =>
		readListingPublicationStatus(ctx, args.listingId)
	)
	.internal();

export const publishListingInternal = convex
	.mutation()
	.input({
		actorAuthId: v.string(),
		listingId: v.id("listings"),
	})
	.handler(async (ctx, args) =>
		publishListingRecord(ctx, {
			actorAuthId: args.actorAuthId,
			listingId: args.listingId,
			now: Date.now(),
		})
	)
	.internal();

export const hideListingInternal = convex
	.mutation()
	.input({
		actorAuthId: v.string(),
		listingId: v.id("listings"),
	})
	.handler(async (ctx, args) =>
		hideListingRecord(ctx, {
			actorAuthId: args.actorAuthId,
			listingId: args.listingId,
			now: Date.now(),
		})
	)
	.internal();
