import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

function toBusinessDate(timestamp: number) {
	return new Date(timestamp).toISOString().slice(0, 10);
}

function trimToUndefined(value: string | undefined) {
	if (typeof value !== "string") {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

type OriginationValuationComparableDraft = NonNullable<
	NonNullable<Doc<"adminOriginationCases">["valuationDraft"]>["comparables"]
>[number];

export async function createOriginationValuationSnapshot(
	ctx: Pick<MutationCtx, "db">,
	args: {
		comparables?: readonly OriginationValuationComparableDraft[];
		createdAt: number;
		createdByUserId: Id<"users">;
		mortgageId: Id<"mortgages">;
		relatedDocumentAssetId?: Id<"documentAssets">;
		source: "admin_origination" | "appraisal_import" | "underwriting";
		termStartDate: string;
		valuationDate?: string;
		valueAsIs: number;
	}
) {
	const mortgage = await ctx.db.get(args.mortgageId);
	if (!mortgage) {
		throw new ConvexError("Mortgage no longer exists for valuation snapshot");
	}
	const valuationDate =
		args.valuationDate?.trim() ||
		args.termStartDate ||
		toBusinessDate(args.createdAt);
	const relatedDocumentAsset = args.relatedDocumentAssetId
		? await ctx.db.get(args.relatedDocumentAssetId)
		: null;
	if (args.relatedDocumentAssetId && !relatedDocumentAsset) {
		throw new ConvexError("Related valuation document asset no longer exists");
	}
	const valuationSnapshotId = await ctx.db.insert(
		"mortgageValuationSnapshots",
		{
			createdAt: args.createdAt,
			createdByUserId: args.createdByUserId,
			mortgageId: args.mortgageId,
			relatedDocumentAssetId: args.relatedDocumentAssetId,
			source: args.source,
			valueAsIs: args.valueAsIs,
			valuationDate,
		}
	);
	const appraisalId = await ctx.db.insert("appraisals", {
		propertyId: mortgage.propertyId,
		appraisalType: "as_is",
		appraisedValue: args.valueAsIs,
		appraiserName: "FairLend Origination Workspace",
		appraiserFirm: "FairLend",
		effectiveDate: valuationDate,
		reportDate: valuationDate,
		reportFileRef: relatedDocumentAsset?.fileRef,
		createdAt: args.createdAt,
	});
	for (const [index, comparable] of (args.comparables ?? []).entries()) {
		const address = trimToUndefined(comparable.address);
		if (!address) {
			continue;
		}

		await ctx.db.insert("appraisalComparables", {
			address,
			adjustedValue: comparable.adjustedValue,
			adjustments: comparable.adjustments,
			appraisalId,
			createdAt: args.createdAt,
			googlePlaceData: comparable.googlePlaceData,
			latitude: comparable.latitude,
			longitude: comparable.longitude,
			lotSize: trimToUndefined(comparable.lotSize),
			propertyType: trimToUndefined(comparable.propertyType),
			saleDate: trimToUndefined(comparable.saleDate),
			salePrice: comparable.salePrice,
			sortOrder: comparable.sortOrder ?? index,
			squareFootage: comparable.squareFootage,
			yearBuilt: comparable.yearBuilt,
		});
	}

	return { appraisalId, valuationDate, valuationSnapshotId };
}
