import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { listActivePublicStaticBlueprintAssets } from "../documents/mortgageBlueprints";
import { listingQuery } from "../fluent";

type ReadListingPublicDocumentsArgs =
	| { listingId: Id<"listings"> }
	| { mortgageId: Id<"mortgages"> | undefined };

type ReadListingPublicDocumentsArgs =
	| { listingId: Id<"listings"> }
	| { mortgageId: Id<"mortgages"> | undefined };

export async function readListingPublicDocuments(
	ctx: Pick<QueryCtx, "db" | "storage">,
	args: ReadListingPublicDocumentsArgs
) {
	const mortgageId =
		"mortgageId" in args
			? args.mortgageId
			: (await ctx.db.get(args.listingId))?.mortgageId;
	if (!mortgageId) {
		return [];
	}

	const assets = await listActivePublicStaticBlueprintAssets(ctx, mortgageId);
	return Promise.all(
		assets.map(async ({ asset, blueprint }) => ({
			assetId: asset._id,
			blueprintId: blueprint._id,
			class: blueprint.class,
			description: blueprint.description ?? null,
			displayName: blueprint.displayName,
			url: await ctx.storage.getUrl(asset.fileRef),
		}))
	);
}

export const listForListing = listingQuery
	.input({
		listingId: v.id("listings"),
	})
	.handler(async (ctx, args) => {
		const listing = await ctx.db.get(args.listingId);
		if (!listing) {
			throw new ConvexError("Listing not found");
		}
		if (listing.status !== "published") {
			throw new ConvexError("Listing not found");
		}

		return readListingPublicDocuments(ctx, {
			mortgageId: listing.mortgageId,
		});
	})
	.public();
