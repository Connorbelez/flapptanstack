import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { listingQuery } from "../fluent";
import { listPlatformLawyerCheckoutOptions } from "../legalRepresentation/platformLawyers";
import { loadMortgagePaymentSnapshots } from "../payments/mortgagePaymentSnapshot";
import type { PortalPricingPolicyDoc } from "../portals/pricing";
import { projectListingForPortal } from "../portals/pricing";
import {
	attachMarketplaceAvailabilityToListings,
	buildLocationLabel,
	buildMarketplaceAvailabilitySummary,
	deriveMarketplacePropertyType,
	getHeroImageUrl,
	getListingAppraisalsByProperty,
	getListingEncumbrancesByProperty,
	lienPositionToMortgageType,
	type MarketplaceAvailabilitySummary,
} from "./marketplaceShared";
import { buildPaymentHistoryMonthsFromObligations } from "./paymentHistory";
import { getRequiredPortalPricingPolicy } from "./portalProjection";
import {
	clampMarketplaceFiltersToLenderConstraints,
	resolveViewerLenderConstraintForPortal,
} from "./portalVisibility";
import { readListingPublicDocuments } from "./publicDocuments";
import { marketplaceListingPropertyTypeValidator } from "./validators";

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 50;
const FILTERED_LISTING_SCAN_LIMIT = 500;
const SIMILAR_LISTING_CANDIDATE_LIMIT = 50;
const OFFSET_CURSOR_PREFIX = "offset:";
const OFFSET_CURSOR_PATTERN = /^\d+$/;

type ListingDoc = Doc<"listings">;
type ObligationDoc = Doc<"obligations">;
type MarketplacePropertyType = NonNullable<
	ListingDoc["marketplacePropertyType"]
>;
type MortgageTypeLabel = "First" | "Second" | "Other";
type MarketplaceUpcomingPaymentStatus = "due" | "none" | "overdue" | "planned";
interface MarketplacePaymentHistory {
	byStatus: Record<string, number>;
	lastDueDate: number | null;
	months?: unknown[];
	totalObligations: number;
	totalOutstanding: number;
}

export interface MarketplaceFilters {
	availabilityPercent?: { max?: number; min?: number };
	interestRate?: { max?: number; min?: number };
	ltv?: { max?: number; min?: number };
	maturityDate?: { end?: string };
	minimumInvestmentAmount?: { max?: number; min?: number };
	mortgageTypes?: MortgageTypeLabel[];
	principalAmount?: { max?: number; min?: number };
	propertyTypes?: MarketplacePropertyType[];
	searchQuery?: string;
}

export const marketplaceFiltersValidator = v.object({
	searchQuery: v.optional(v.string()),
	availabilityPercent: v.optional(
		v.object({
			max: v.optional(v.number()),
			min: v.optional(v.number()),
		})
	),
	mortgageTypes: v.optional(
		v.array(
			v.union(v.literal("First"), v.literal("Second"), v.literal("Other"))
		)
	),
	minimumInvestmentAmount: v.optional(
		v.object({
			max: v.optional(v.number()),
			min: v.optional(v.number()),
		})
	),
	propertyTypes: v.optional(v.array(marketplaceListingPropertyTypeValidator)),
	ltv: v.optional(
		v.object({
			max: v.optional(v.number()),
			min: v.optional(v.number()),
		})
	),
	interestRate: v.optional(
		v.object({
			max: v.optional(v.number()),
			min: v.optional(v.number()),
		})
	),
	principalAmount: v.optional(
		v.object({
			max: v.optional(v.number()),
			min: v.optional(v.number()),
		})
	),
	maturityDate: v.optional(
		v.object({
			end: v.optional(v.string()),
		})
	),
});

export interface MarketplaceListingsSnapshotArgs {
	cursor?: string | null;
	filters?: MarketplaceFilters;
	numItems?: number;
}

function normalizePageSize(value: number | undefined): number {
	if (!Number.isFinite(value ?? DEFAULT_PAGE_SIZE)) {
		return DEFAULT_PAGE_SIZE;
	}

	const rounded = Math.trunc(value ?? DEFAULT_PAGE_SIZE);
	if (rounded < 1) {
		return DEFAULT_PAGE_SIZE;
	}

	return Math.min(rounded, MAX_PAGE_SIZE);
}

function parseOffsetCursor(cursor: string | null | undefined): number {
	if (cursor == null) {
		return 0;
	}

	const raw = cursor.startsWith(OFFSET_CURSOR_PREFIX)
		? cursor.slice(OFFSET_CURSOR_PREFIX.length)
		: cursor;
	if (!OFFSET_CURSOR_PATTERN.test(raw)) {
		throw new ConvexError("Invalid pagination cursor");
	}

	const offset = Number.parseInt(raw, 10);
	if (!Number.isSafeInteger(offset) || offset < 0) {
		throw new ConvexError("Invalid pagination cursor");
	}

	return offset;
}

function paginateResults<T>(
	items: T[],
	cursor: string | null | undefined,
	numItems: number | undefined
) {
	const offset = parseOffsetCursor(cursor);
	const pageSize = normalizePageSize(numItems);
	const page = items.slice(offset, offset + pageSize);
	const nextOffset = offset + page.length;
	const isDone = nextOffset >= items.length;

	return {
		continueCursor: isDone
			? null
			: `${OFFSET_CURSOR_PREFIX}${String(nextOffset)}`,
		isDone,
		page,
	};
}

export function matchesMarketplaceFilters(
	listing: ListingDoc,
	filters: MarketplaceFilters | undefined,
	availability?: MarketplaceAvailabilitySummary
) {
	if (!filters) {
		return true;
	}

	const searchQuery = filters.searchQuery?.trim().toLowerCase();
	const mortgageType = lienPositionToMortgageType(listing.lienPosition);
	const minimumInvestmentAmount = listing.principal / 10;

	return [
		!searchQuery ||
			listing.title?.toLowerCase().includes(searchQuery) ||
			listing.city.toLowerCase().includes(searchQuery) ||
			listing.province.toLowerCase().includes(searchQuery) ||
			listing.marketplaceCopy?.toLowerCase().includes(searchQuery) ||
			listing.description?.toLowerCase().includes(searchQuery),
		filters.mortgageTypes === undefined ||
			filters.mortgageTypes.includes(mortgageType),
		filters.propertyTypes === undefined ||
			(listing.marketplacePropertyType !== undefined &&
				filters.propertyTypes.includes(listing.marketplacePropertyType)),
		filters.ltv?.min === undefined || listing.ltvRatio >= filters.ltv.min,
		filters.ltv?.max === undefined || listing.ltvRatio <= filters.ltv.max,
		filters.interestRate?.min === undefined ||
			listing.interestRate >= filters.interestRate.min,
		filters.interestRate?.max === undefined ||
			listing.interestRate <= filters.interestRate.max,
		filters.minimumInvestmentAmount?.min === undefined ||
			minimumInvestmentAmount >= filters.minimumInvestmentAmount.min,
		filters.minimumInvestmentAmount?.max === undefined ||
			minimumInvestmentAmount <= filters.minimumInvestmentAmount.max,
		filters.principalAmount?.min === undefined ||
			listing.principal >= filters.principalAmount.min,
		filters.principalAmount?.max === undefined ||
			listing.principal <= filters.principalAmount.max,
		filters.maturityDate?.end === undefined ||
			listing.maturityDate <= filters.maturityDate.end,
		filters.availabilityPercent?.min === undefined ||
			availability === undefined ||
			availability.availablePercent >= filters.availabilityPercent.min,
		filters.availabilityPercent?.max === undefined ||
			availability === undefined ||
			availability.availablePercent <= filters.availabilityPercent.max,
	].every(Boolean);
}

function filtersRequireAvailability(filters: MarketplaceFilters | undefined) {
	return (
		filters?.availabilityPercent?.min !== undefined ||
		filters?.availabilityPercent?.max !== undefined
	);
}

export function compareMarketplaceListings(
	left: ListingDoc,
	right: ListingDoc
) {
	if (left.featured !== right.featured) {
		return left.featured ? -1 : 1;
	}

	const leftDisplayOrder = left.displayOrder ?? Number.MAX_SAFE_INTEGER;
	const rightDisplayOrder = right.displayOrder ?? Number.MAX_SAFE_INTEGER;
	if (leftDisplayOrder !== rightDisplayOrder) {
		return leftDisplayOrder - rightDisplayOrder;
	}

	const leftPublishedAt = left.publishedAt ?? 0;
	const rightPublishedAt = right.publishedAt ?? 0;
	if (leftPublishedAt !== rightPublishedAt) {
		return rightPublishedAt - leftPublishedAt;
	}

	return String(left._id).localeCompare(String(right._id));
}

async function takeBoundedPublishedListings(
	query: {
		take: (limit: number) => Promise<ListingDoc[]>;
	},
	limitLabel: string
) {
	const listings = await query.take(FILTERED_LISTING_SCAN_LIMIT + 1);
	if (listings.length > FILTERED_LISTING_SCAN_LIMIT) {
		throw new ConvexError(
			`Too many published listings matched ${limitLabel}; narrow filters before paginating`
		);
	}

	return listings;
}

function buildListingSummary(listing: ListingDoc): string {
	return listing.marketplaceCopy ?? listing.description ?? "Mortgage Listing";
}

function toMarketplaceUpcomingPaymentStatus(
	obligation: ObligationDoc
): MarketplaceUpcomingPaymentStatus {
	switch (obligation.status) {
		case "due":
			return "due";
		case "overdue":
		case "partially_settled":
			return "overdue";
		default:
			return "planned";
	}
}

function readProjectedPaymentHistoryMonths(
	paymentHistory: unknown
): unknown[] | undefined {
	if (
		typeof paymentHistory !== "object" ||
		paymentHistory === null ||
		!("months" in paymentHistory)
	) {
		return undefined;
	}

	const months = paymentHistory.months;
	return Array.isArray(months) ? months : undefined;
}

async function loadMarketplacePaymentHistory(
	ctx: Pick<QueryCtx, "db">,
	mortgageId: ListingDoc["mortgageId"],
	projectedPaymentHistory: unknown
): Promise<MarketplacePaymentHistory | null> {
	if (!mortgageId) {
		return null;
	}

	const obligations = (
		await ctx.db
			.query("obligations")
			.withIndex("by_mortgage_and_date", (q) => q.eq("mortgageId", mortgageId))
			.collect()
	).filter((obligation) => obligation.archivedAt === undefined);

	if (obligations.length === 0) {
		return null;
	}

	const byStatus = obligations.reduce<Record<string, number>>(
		(summary, obligation) => {
			summary[obligation.status] = (summary[obligation.status] ?? 0) + 1;
			return summary;
		},
		{}
	);
	const lastDueDate = obligations.reduce<number | null>(
		(latest, obligation) =>
			latest === null
				? obligation.dueDate
				: Math.max(latest, obligation.dueDate),
		null
	);
	const liveMonths = buildPaymentHistoryMonthsFromObligations(obligations);
	const months =
		liveMonths.length > 0
			? liveMonths
			: readProjectedPaymentHistoryMonths(projectedPaymentHistory);

	return {
		byStatus,
		lastDueDate,
		...(months ? { months } : {}),
		totalObligations: obligations.length,
		totalOutstanding: obligations.reduce((total, obligation) => {
			if (obligation.status === "settled" || obligation.status === "waived") {
				return total;
			}
			return total + Math.max(0, obligation.amount - obligation.amountSettled);
		}, 0),
	};
}

async function loadMarketplaceNextPaymentDue(
	ctx: Pick<QueryCtx, "db">,
	mortgageId: ListingDoc["mortgageId"]
) {
	if (!mortgageId) {
		return null;
	}

	const obligation = await ctx.db
		.query("obligations")
		.withIndex("by_mortgage_and_date", (q) => q.eq("mortgageId", mortgageId))
		.order("asc")
		.filter((q) =>
			q.and(
				q.neq(q.field("status"), "settled"),
				q.neq(q.field("status"), "waived")
			)
		)
		.first();

	if (!obligation) {
		return {
			amount: null,
			date: null,
			obligationId: null,
			planEntryId: null,
			status: "none" satisfies MarketplaceUpcomingPaymentStatus,
		};
	}

	const planEntriesByStatus = await Promise.all(
		(["planned", "provider_scheduled", "executing"] as const).map((status) =>
			ctx.db
				.query("collectionPlanEntries")
				.withIndex("by_mortgage_status_scheduled", (q) =>
					q.eq("mortgageId", mortgageId).eq("status", status)
				)
				.collect()
		)
	);
	const planEntry =
		planEntriesByStatus
			.flat()
			.find((entry) => entry.obligationIds.includes(obligation._id)) ?? null;

	return {
		amount: obligation.amount,
		date: obligation.dueDate,
		obligationId: String(obligation._id),
		planEntryId: planEntry ? String(planEntry._id) : null,
		status: toMarketplaceUpcomingPaymentStatus(obligation),
	};
}

function getMarketplacePropertyType(
	listing: ListingDoc
): MarketplacePropertyType {
	return (
		listing.marketplacePropertyType ??
		deriveMarketplacePropertyType(listing.propertyType)
	);
}

export async function collectMarketplaceListingCandidates(
	ctx: Pick<QueryCtx, "db">,
	filters: MarketplaceFilters | undefined
): Promise<ListingDoc[]> {
	if (filters?.propertyTypes?.length === 1) {
		const propertyType = filters.propertyTypes[0];
		return await takeBoundedPublishedListings(
			ctx.db
				.query("listings")
				.withIndex("by_marketplace_property_type_and_status", (q) =>
					q
						.eq("marketplacePropertyType", propertyType)
						.eq("status", "published")
				),
			`property type ${propertyType}`
		);
	}

	if (filters?.mortgageTypes?.length === 1) {
		const mortgageType = filters.mortgageTypes[0];
		if (mortgageType === "First" || mortgageType === "Second") {
			return await takeBoundedPublishedListings(
				ctx.db
					.query("listings")
					.withIndex("by_lien_position_and_status", (q) =>
						q
							.eq("lienPosition", mortgageType === "First" ? 1 : 2)
							.eq("status", "published")
					),
				`mortgage type ${mortgageType}`
			);
		}
	}

	return await takeBoundedPublishedListings(
		ctx.db
			.query("listings")
			.withIndex("by_status", (q) => q.eq("status", "published")),
		"default marketplace listing scan"
	);
}

async function getSimilarMarketplaceListings(
	ctx: Pick<QueryCtx, "db" | "storage">,
	listing: ListingDoc,
	pricingPolicy?: Parameters<typeof projectListingForPortal>[1]
) {
	// TODO: Add an index ordered for featured/displayOrder/publishedAt so this
	// detail hot path can read the top 3 similar listings without JS sorting.
	const samePropertyTypeCandidates = await ctx.db
		.query("listings")
		.withIndex("by_marketplace_property_type_and_status", (q) =>
			q
				.eq("marketplacePropertyType", getMarketplacePropertyType(listing))
				.eq("status", "published")
		)
		.take(SIMILAR_LISTING_CANDIDATE_LIMIT);

	const candidatesById = new Map<string, ListingDoc>();
	for (const candidate of samePropertyTypeCandidates) {
		candidatesById.set(String(candidate._id), candidate);
	}

	if (candidatesById.size < 4) {
		const fallbackCandidates = await ctx.db
			.query("listings")
			.withIndex("by_status", (q) => q.eq("status", "published"))
			.take(SIMILAR_LISTING_CANDIDATE_LIMIT);

		for (const candidate of fallbackCandidates) {
			candidatesById.set(String(candidate._id), candidate);
		}
	}

	const similarListings = Array.from(candidatesById.values())
		.filter((candidate) => candidate._id !== listing._id)
		.sort(compareMarketplaceListings)
		.slice(0, 3);

	return await Promise.all(
		similarListings.map(async (candidate) => {
			const projectedCandidate = pricingPolicy
				? projectListingForPortal(candidate, pricingPolicy)
				: candidate;

			return {
				heroImageUrl: await getHeroImageUrl(ctx, candidate.heroImages[0]),
				id: String(candidate._id),
				interestRate: projectedCandidate.interestRate,
				locationLabel: buildLocationLabel(candidate) ?? "",
				ltvRatio: candidate.ltvRatio,
				mortgageTypeLabel: lienPositionToMortgageType(candidate.lienPosition),
				principal: projectedCandidate.principal,
				propertyTypeLabel: getMarketplacePropertyType(candidate),
				title: candidate.title ?? "Mortgage Listing",
			};
		})
	);
}

async function getMarketplacePlatformLawyers(ctx: Pick<QueryCtx, "db">) {
	const options = await listPlatformLawyerCheckoutOptions(ctx);
	return options.map((option) => ({
		authId: option.lawyerId,
		activeDealCount: option.activeDealCount,
		availability: option.availability,
		barNumber: option.barNumber ?? null,
		capacityLimit: option.capacityLimit,
		capacityWarning: option.capacityWarning,
		displayName: option.name,
		email: option.email,
		eligibilityStatus: option.eligibilityStatus,
		firmName: option.firm ?? null,
		jurisdiction: option.jurisdiction ?? null,
		latestVerificationId: option.latestVerificationId ?? null,
		lawyerProfileId: option.lawyerProfileId,
		platformStatus: option.platformStatus,
		role: "platform_lawyer",
		slaTier: option.slaTier ?? null,
	}));
}

function resolveRequestedPageSize(args: {
	numItems: number | undefined;
	pageSizeCap?: number;
}) {
	if (args.pageSizeCap === undefined) {
		return args.numItems;
	}

	return Math.min(normalizePageSize(args.numItems), args.pageSizeCap);
}

function isDealLockCheckoutProviderConfigured() {
	return Boolean(process.env.STRIPE_SECRET_KEY);
}

export async function listMarketplaceListingsSnapshot(
	ctx: Pick<QueryCtx, "db" | "storage">,
	args: MarketplaceListingsSnapshotArgs,
	options?: {
		pageSizeCap?: number;
		pricingPolicy?: Pick<PortalPricingPolicyDoc, "brokerSplitPercent"> | null;
	}
) {
	const candidates = await collectMarketplaceListingCandidates(
		ctx,
		args.filters
	);
	const filtered = candidates
		.filter((listing) => matchesMarketplaceFilters(listing, args.filters))
		.sort(compareMarketplaceListings);

	const pageSize = resolveRequestedPageSize({
		numItems: args.numItems,
		pageSizeCap: options?.pageSizeCap,
	});
	const pageWithAvailability = await (async () => {
		if (filtersRequireAvailability(args.filters)) {
			const availableCandidates = await attachMarketplaceAvailabilityToListings(
				ctx,
				filtered
			);
			const filteredByAvailability = availableCandidates.filter(
				({ availability, listing }) =>
					matchesMarketplaceFilters(listing, args.filters, availability)
			);
			const paginatedWithAvailability = paginateResults(
				filteredByAvailability,
				args.cursor ?? null,
				pageSize
			);
			return {
				continueCursor: paginatedWithAvailability.continueCursor,
				isDone: paginatedWithAvailability.isDone,
				page: paginatedWithAvailability.page,
			};
		}

		const paginatedListings = paginateResults(
			filtered,
			args.cursor ?? null,
			pageSize
		);
		return {
			continueCursor: paginatedListings.continueCursor,
			isDone: paginatedListings.isDone,
			page: await attachMarketplaceAvailabilityToListings(
				ctx,
				paginatedListings.page
			),
		};
	})();

	return {
		continueCursor: pageWithAvailability.continueCursor,
		isDone: pageWithAvailability.isDone,
		page: await Promise.all(
			pageWithAvailability.page.map(async ({ availability, listing }) => {
				const projectedListing = options?.pricingPolicy
					? projectListingForPortal(listing, options.pricingPolicy)
					: listing;

				return {
					approximateLatitude: projectedListing.approximateLatitude ?? null,
					approximateLongitude: projectedListing.approximateLongitude ?? null,
					availability,
					displayOrder: projectedListing.displayOrder ?? null,
					featured: projectedListing.featured,
					heroImageUrl: await getHeroImageUrl(
						ctx,
						projectedListing.heroImages[0]
					),
					id: String(projectedListing._id),
					interestRate: projectedListing.interestRate,
					locationLabel: buildLocationLabel(projectedListing) ?? "",
					ltvRatio: projectedListing.ltvRatio,
					marketplaceCopy:
						projectedListing.marketplaceCopy ??
						projectedListing.description ??
						"",
					maturityDate: projectedListing.maturityDate,
					mortgageId: projectedListing.mortgageId
						? String(projectedListing.mortgageId)
						: null,
					mortgageTypeLabel: lienPositionToMortgageType(
						projectedListing.lienPosition
					),
					principal: projectedListing.principal,
					propertyTypeLabel:
						projectedListing.marketplacePropertyType ??
						deriveMarketplacePropertyType(projectedListing.propertyType),
					termMonths: projectedListing.termMonths,
					title: projectedListing.title ?? "Mortgage Listing",
				};
			})
		),
	};
}

export const listMarketplaceListings = listingQuery
	.input({
		cursor: v.optional(v.union(v.string(), v.null())),
		filters: v.optional(marketplaceFiltersValidator),
		numItems: v.optional(v.number()),
		portalId: v.id("portals"),
	})
	.handler(async (ctx, args) => {
		const pricingPolicy = await getRequiredPortalPricingPolicy(
			ctx,
			args.portalId
		);
		const lenderConstraint = await resolveViewerLenderConstraintForPortal(ctx, {
			portalId: args.portalId,
			viewerAuthId: ctx.viewer.authId,
			viewerIsFairLendAdmin: ctx.viewer.isFairLendAdmin,
		});
		const effectiveFilters = clampMarketplaceFiltersToLenderConstraints(
			args.filters,
			lenderConstraint
		);
		const snapshot = await listMarketplaceListingsSnapshot(
			ctx,
			{
				cursor: args.cursor,
				filters: effectiveFilters,
				numItems: args.numItems,
			},
			{
				pricingPolicy,
			}
		);
		return {
			...snapshot,
			effectiveFilters,
		};
	})
	.public();

export const getMarketplaceListingDetail = listingQuery
	.input({ listingId: v.id("listings"), portalId: v.id("portals") })
	.handler(async (ctx, args) => {
		const listing = await ctx.db.get(args.listingId);
		if (!listing || listing.status !== "published") {
			return null;
		}

		const pricingPolicy = await getRequiredPortalPricingPolicy(
			ctx,
			args.portalId
		);
		const lenderConstraint = await resolveViewerLenderConstraintForPortal(ctx, {
			portalId: args.portalId,
			viewerAuthId: ctx.viewer.authId,
			viewerIsFairLendAdmin: ctx.viewer.isFairLendAdmin,
		});
		const visibilityFilters = clampMarketplaceFiltersToLenderConstraints(
			undefined,
			lenderConstraint
		);
		if (!matchesMarketplaceFilters(listing, visibilityFilters)) {
			return null;
		}
		const projectedListing = projectListingForPortal(listing, pricingPolicy);

		const [
			investmentSummary,
			documents,
			appraisals,
			encumbrances,
			similarListings,
			platformLawyers,
			paymentSnapshots,
			nextPaymentDue,
			livePaymentHistory,
		] = await Promise.all([
			buildMarketplaceAvailabilitySummary(ctx, listing.mortgageId),
			readListingPublicDocuments(ctx, {
				mortgageId: listing.mortgageId,
			}),
			listing.propertyId
				? getListingAppraisalsByProperty(ctx, listing.propertyId)
				: Promise.resolve([]),
			listing.propertyId
				? getListingEncumbrancesByProperty(ctx, listing.propertyId)
				: Promise.resolve([]),
			getSimilarMarketplaceListings(ctx, listing, pricingPolicy),
			getMarketplacePlatformLawyers(ctx),
			listing.mortgageId
				? loadMortgagePaymentSnapshots(ctx, [listing.mortgageId])
				: Promise.resolve(new Map()),
			loadMarketplaceNextPaymentDue(ctx, listing.mortgageId),
			loadMarketplacePaymentHistory(
				ctx,
				listing.mortgageId,
				listing.paymentHistory
			),
		]);
		const paymentSnapshot = listing.mortgageId
			? (paymentSnapshots.get(String(listing.mortgageId)) ?? null)
			: null;

		return {
			appraisals,
			documents,
			encumbrances,
			investment: {
				availableFractions: investmentSummary.availableFractions,
				checkoutReady:
					investmentSummary.availableFractions > 0 &&
					platformLawyers.length > 0 &&
					isDealLockCheckoutProviderConfigured(),
				investorCount: investmentSummary.totalInvestors,
				lockedPercent: investmentSummary.lockedPercent,
				soldPercent: investmentSummary.soldPercent,
				totalFractions: investmentSummary.totalFractions,
			},
			listing: {
				approximateLatitude: listing.approximateLatitude ?? null,
				approximateLongitude: listing.approximateLongitude ?? null,
				borrowerSignal: listing.borrowerSignal ?? null,
				heroImages: await Promise.all(
					listing.heroImages.map(async (image, index) => ({
						caption: image.caption ?? null,
						id: `${String(listing._id)}:${String(index)}`,
						url: await getHeroImageUrl(ctx, image),
					}))
				),
				id: String(listing._id),
				interestRate: projectedListing.interestRate,
				locationLabel: buildLocationLabel(listing) ?? "",
				lienPosition: listing.lienPosition,
				ltvRatio: listing.ltvRatio,
				marketplaceCopy: buildListingSummary(listing),
				maturityDate: listing.maturityDate,
				mortgageId: listing.mortgageId ? String(listing.mortgageId) : null,
				mortgageTypeLabel: lienPositionToMortgageType(listing.lienPosition),
				monthlyPayment: projectedListing.monthlyPayment,
				paymentFrequency: listing.paymentFrequency,
				paymentHistory: livePaymentHistory ?? listing.paymentHistory ?? null,
				nextPaymentDue,
				paymentSnapshot,
				principal: listing.principal,
				propertyTypeLabel: getMarketplacePropertyType(listing),
				rateType: listing.rateType,
				readOnly: true,
				summary: buildListingSummary(listing),
				termMonths: listing.termMonths,
				title: listing.title ?? "Mortgage Listing",
			},
			lawyers: platformLawyers,
			similarListings,
		};
	})
	.public();
