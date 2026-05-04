import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { listActivePublicStaticBlueprintAssets } from "../documents/mortgageBlueprints";
import { authedQuery, convex, requireOrgContext, type Viewer } from "../fluent";

type ReadListingPublicDocumentsArgs =
	| { listingId: Id<"listings"> }
	| { mortgageId: Id<"mortgages"> | undefined };

function canViewPublicListingDocuments(viewer: Viewer) {
	if (viewer.isFairLendAdmin) {
		return true;
	}

	for (const role of viewer.roles) {
		if (role !== "member") {
			return true;
		}
	}

	return viewer.role !== undefined && viewer.role !== "member";
}

const requirePublicListingDocumentAccess = convex
	.$context<{ viewer: Viewer }>()
	.createMiddleware(async (context, next) => {
		if (!canViewPublicListingDocuments(context.viewer)) {
			throw new ConvexError("Forbidden: public document access required");
		}

		return next(context);
	});

const publicListingDocumentQuery = authedQuery
	.use(requireOrgContext)
	.use(requirePublicListingDocumentAccess);

function deriveListingPublicDocumentKind(args: {
	contentType?: string | null;
	fileName?: string | null;
}) {
	if (args.contentType?.toLowerCase().includes("pdf")) {
		return "pdf" as const;
	}

	if (args.fileName?.toLowerCase().endsWith(".pdf")) {
		return "pdf" as const;
	}

	return "other" as const;
}

async function serializeListingPublicDocument(
	ctx: Pick<QueryCtx, "storage">,
	entry: Awaited<
		ReturnType<typeof listActivePublicStaticBlueprintAssets>
	>[number]
) {
	const { asset, blueprint } = entry;
	const contentType = asset.mimeType ?? null;
	const fileName = asset.originalFilename ?? asset.name ?? null;

	return {
		assetId: asset._id,
		blueprintId: blueprint._id,
		class: blueprint.class,
		contentType,
		description: blueprint.description ?? null,
		displayName: blueprint.displayName,
		fileName,
		kind: deriveListingPublicDocumentKind({ contentType, fileName }),
		url: await ctx.storage.getUrl(asset.fileRef),
	};
}

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
		assets.map((entry) => serializeListingPublicDocument(ctx, entry))
	);
}

async function requirePublishedListing(
	ctx: Pick<QueryCtx, "db">,
	listingId: Id<"listings">
) {
	const listing = await ctx.db.get(listingId);
	if (!listing || listing.status !== "published") {
		throw new ConvexError("Listing not found");
	}

	return listing;
}

export const listForListing = publicListingDocumentQuery
	.input({
		listingId: v.id("listings"),
	})
	.handler(async (ctx, args) => {
		const listing = await requirePublishedListing(ctx, args.listingId);

		return readListingPublicDocuments(ctx, {
			mortgageId: listing.mortgageId,
		});
	})
	.public();

export const refreshForListingAsset = publicListingDocumentQuery
	.input({
		assetId: v.id("documentAssets"),
		listingId: v.id("listings"),
	})
	.handler(async (ctx, args) => {
		await requirePublishedListing(ctx, args.listingId);

		const documents = await readListingPublicDocuments(ctx, {
			listingId: args.listingId,
		});
		return (
			documents.find((document) => document.assetId === args.assetId) ?? null
		);
	})
	.public();
