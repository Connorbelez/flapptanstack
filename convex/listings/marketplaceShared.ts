import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { TOTAL_SUPPLY } from "../ledger/constants";
import { buildMortgageSaleInventorySummary } from "../marketplace/saleInventory";

export interface MarketplaceAvailabilitySummary {
	availableFractions: number;
	availablePercent: number;
	lockedFractions: number;
	lockedPercent: number;
	soldFractions: number;
	soldPercent: number;
	totalFractions: number;
	totalInvestors: number;
}

function roundToTwoDecimals(value: number): number {
	return Math.round(value * 100) / 100;
}

function toSafeNumber(value: bigint, label: string): number {
	if (
		value > BigInt(Number.MAX_SAFE_INTEGER) ||
		value < BigInt(Number.MIN_SAFE_INTEGER)
	) {
		throw new Error(`${label} exceeds Number safe integer range`);
	}

	return Number(value);
}

function buildAvailabilitySummary(args: {
	availableFractions: number;
	lockedFractions: number;
	soldFractions: number;
	totalFractions: number;
	totalInvestors: number;
}): MarketplaceAvailabilitySummary {
	return {
		availableFractions: args.availableFractions,
		availablePercent: roundToTwoDecimals(
			(args.availableFractions / Math.max(args.totalFractions, 1)) * 100
		),
		lockedFractions: args.lockedFractions,
		lockedPercent: roundToTwoDecimals(
			(args.lockedFractions / Math.max(args.totalFractions, 1)) * 100
		),
		soldFractions: args.soldFractions,
		soldPercent: roundToTwoDecimals(
			(args.soldFractions / Math.max(args.totalFractions, 1)) * 100
		),
		totalFractions: args.totalFractions,
		totalInvestors: args.totalInvestors,
	};
}

export function deriveMarketplacePropertyType(
	propertyType: Doc<"listings">["propertyType"]
): NonNullable<Doc<"listings">["marketplacePropertyType"]> {
	switch (propertyType) {
		case "condo":
			return "Condo";
		case "multi_unit":
			return "Duplex";
		case "commercial":
			return "Commercial";
		case "residential":
			return "Detached Home";
		default: {
			const _exhaustive: never = propertyType;
			return _exhaustive;
		}
	}
}

export function lienPositionToMortgageType(
	lienPosition: number
): "First" | "Second" | "Other" {
	if (lienPosition === 1) {
		return "First";
	}

	if (lienPosition === 2) {
		return "Second";
	}

	return "Other";
}

export async function buildMarketplaceAvailabilitySummary(
	ctx: { db: Pick<QueryCtx["db"], "get" | "query"> },
	mortgageId: Doc<"listings">["mortgageId"]
): Promise<MarketplaceAvailabilitySummary> {
	const totalFractions = toSafeNumber(TOTAL_SUPPLY, "totalFractions");
	if (!mortgageId) {
		return buildAvailabilitySummary({
			availableFractions: totalFractions,
			lockedFractions: 0,
			soldFractions: 0,
			totalFractions,
			totalInvestors: 0,
		});
	}

	const saleInventory = await buildMortgageSaleInventorySummary(
		ctx,
		mortgageId
	);

	return buildAvailabilitySummary({
		availableFractions: saleInventory.availableForSaleLedgerUnits,
		lockedFractions: saleInventory.lockedLedgerUnits,
		soldFractions: saleInventory.soldLedgerUnits,
		totalFractions,
		totalInvestors: saleInventory.totalInvestors,
	});
}

export async function attachMarketplaceAvailabilityToListings(
	ctx: { db: Pick<QueryCtx["db"], "get" | "query"> },
	listings: Doc<"listings">[]
) {
	const mortgageIds = [
		...new Set(
			listings
				.map((listing) => listing.mortgageId)
				.filter(
					(mortgageId): mortgageId is NonNullable<typeof mortgageId> =>
						mortgageId !== undefined
				)
		),
	];
	const availabilityByMortgageId = new Map<
		NonNullable<Doc<"listings">["mortgageId"]>,
		MarketplaceAvailabilitySummary
	>();

	await Promise.all(
		mortgageIds.map(async (mortgageId) => {
			availabilityByMortgageId.set(
				mortgageId,
				await buildMarketplaceAvailabilitySummary(ctx, mortgageId)
			);
		})
	);

	return await Promise.all(
		listings.map(async (listing) => ({
			availability:
				listing.mortgageId === undefined
					? await buildMarketplaceAvailabilitySummary(ctx, undefined)
					: (availabilityByMortgageId.get(listing.mortgageId) ??
						(await buildMarketplaceAvailabilitySummary(
							ctx,
							listing.mortgageId
						))),
			listing,
		}))
	);
}

export async function getListingAppraisalsByProperty(
	ctx: {
		db: Pick<QueryCtx["db"], "get" | "query">;
		storage: Pick<QueryCtx["storage"], "getUrl">;
	},
	propertyId: NonNullable<Doc<"listings">["propertyId"]>
) {
	const appraisals = await ctx.db
		.query("appraisals")
		.withIndex("by_property", (q) => q.eq("propertyId", propertyId))
		.collect();

	appraisals.sort((left, right) => {
		const byEffectiveDate = right.effectiveDate.localeCompare(
			left.effectiveDate
		);
		if (byEffectiveDate !== 0) {
			return byEffectiveDate;
		}

		return right.createdAt - left.createdAt;
	});

	const appraisalsWithComparables = await Promise.all(
		appraisals.map(async (appraisal) => {
			const comparables = await ctx.db
				.query("appraisalComparables")
				.withIndex("by_appraisal", (q) => q.eq("appraisalId", appraisal._id))
				.collect();

			comparables.sort((left, right) => left.sortOrder - right.sortOrder);
			const comparableEvidenceAssets = await Promise.all(
				comparables.map((comparable) =>
					resolveComparableEvidenceAssets(ctx, comparable.evidenceAssetIds)
				)
			);

			return {
				comparables: comparables.map((comparable, index) => ({
					address: comparable.address,
					adjustedValue: comparable.adjustedValue ?? null,
					evidenceAssetIds: (comparable.evidenceAssetIds ?? []).map(String),
					evidenceAssets: comparableEvidenceAssets[index] ?? [],
					id: String(comparable._id),
					propertyType: comparable.propertyType ?? null,
					saleDate: comparable.saleDate ?? null,
					salePrice: comparable.salePrice ?? null,
					squareFootage: comparable.squareFootage ?? null,
				})),
				effectiveDate: appraisal.effectiveDate,
				id: String(appraisal._id),
				reportDate: appraisal.reportDate,
				type: appraisal.appraisalType,
				valueAsIfComplete: appraisal.asIfValue ?? null,
				valueAsIs: appraisal.appraisedValue,
			};
		})
	);

	return appraisalsWithComparables;
}

async function resolveComparableEvidenceAssets(
	ctx: {
		db: Pick<QueryCtx["db"], "get">;
		storage: Pick<QueryCtx["storage"], "getUrl">;
	},
	evidenceAssetIds: readonly Doc<"documentAssets">["_id"][] | undefined
) {
	if (!evidenceAssetIds?.length) {
		return [];
	}

	return (
		await Promise.all(
			evidenceAssetIds.map(async (assetId) => {
				const asset = await ctx.db.get(assetId);
				if (!asset) {
					return null;
				}

				return {
					assetId: String(asset._id),
					contentType: asset.mimeType,
					fileName: asset.originalFilename,
					kind: asset.mimeType.startsWith("image/")
						? ("image" as const)
						: ("file" as const),
					label: asset.name,
					url: await ctx.storage.getUrl(asset.fileRef),
				};
			})
		)
	).filter((asset): asset is NonNullable<typeof asset> => asset !== null);
}

export async function getListingEncumbrancesByProperty(
	ctx: { db: Pick<QueryCtx["db"], "query"> },
	propertyId: NonNullable<Doc<"listings">["propertyId"]>
) {
	const encumbrances = await ctx.db
		.query("priorEncumbrances")
		.withIndex("by_property", (q) => q.eq("propertyId", propertyId))
		.collect();

	encumbrances.sort((left, right) => {
		if (left.priority !== right.priority) {
			return left.priority - right.priority;
		}

		return right.createdAt - left.createdAt;
	});

	return encumbrances.map((encumbrance) => ({
		balanceAsOfDate: encumbrance.balanceAsOfDate ?? null,
		holder: encumbrance.holder,
		id: String(encumbrance._id),
		outstandingBalance: encumbrance.outstandingBalance ?? null,
		priority: encumbrance.priority,
		type: encumbrance.encumbranceType,
	}));
}

export async function getHeroImageUrl(
	ctx: Pick<QueryCtx, "storage">,
	heroImage: Doc<"listings">["heroImages"][number] | undefined
) {
	if (!heroImage) {
		return null;
	}

	return await ctx.storage.getUrl(heroImage.storageId);
}

export function buildLocationLabel(
	listing: Pick<Doc<"listings">, "city" | "province">
) {
	const parts = [listing.city.trim(), listing.province.trim()].filter(
		(part) => part.length > 0
	);
	return parts.length > 0 ? parts.join(", ") : null;
}
