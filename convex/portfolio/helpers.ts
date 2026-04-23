import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { buildPortfolioAccrualBreakdown } from "../accrual/queryHelpers";
import type { Viewer } from "../fluent";
import { getAccountLenderId } from "../ledger/accountOwnership";
import { getPostedBalance } from "../ledger/accounts";
import { TOTAL_SUPPLY } from "../ledger/constants";
import { unixMsToBusinessDate } from "../lib/businessDates";
import {
	collectMarketplaceListingCandidates,
	compareMarketplaceListings,
	type listMarketplaceListingsSnapshot,
	matchesMarketplaceFilters,
} from "../listings/marketplace";
import {
	attachMarketplaceAvailabilityToListings,
	buildLocationLabel,
	deriveMarketplacePropertyType,
	getHeroImageUrl,
	lienPositionToMortgageType,
} from "../listings/marketplaceShared";
import {
	clampMarketplaceFiltersToLenderConstraints,
	loadLenderFilterConstraint,
} from "../listings/portalVisibility";
import { getAvailableLenderPayableBalanceImpl } from "../payments/cashLedger/queries";
import type { PortalLenderContext } from "../portals/middleware";
import {
	loadPortalPricingSelection,
	type PortalPricingPolicyDoc,
	projectListingForPortal,
} from "../portals/pricing";
import type {
	PortfolioActionItem,
	PortfolioBrokerPrefillContext,
	PortfolioBrokerSummary,
	PortfolioCommandCenter,
	PortfolioPaymentDetail,
	PortfolioPaymentRow,
	PortfolioPositionDetail,
	PortfolioPositionRow,
	PortfolioSourceOfTruth,
	PortfolioSuggestedOpportunitiesSection,
	PortfolioSuggestedOpportunity,
	PortfolioSuggestionReasonTag,
	PortfolioTimelineEvent,
} from "./contracts";

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;
const POSITION_UNITS_PER_FRACTION = 1000;
const SUGGESTED_OPPORTUNITY_LIMIT = 5;

type PortfolioQueryContext = Pick<QueryCtx, "db" | "storage"> &
	PortalLenderContext & { viewer: Pick<Viewer, "authId"> };
type MarketplaceSuggestionRow = Awaited<
	ReturnType<typeof listMarketplaceListingsSnapshot>
>["page"][number];

interface ActiveLenderPositionAccount {
	accountId: Id<"ledger_accounts">;
	balanceUnits: number;
	mortgageId: Id<"mortgages">;
}

interface MortgagePaymentContext {
	latestAttempt: Doc<"collectionAttempts"> | null;
	latestTransfer: Doc<"transferRequests"> | null;
	obligation: Doc<"obligations">;
	row: PortfolioPaymentRow;
}

const PORTFOLIO_SOURCE_OF_TRUTH: PortfolioSourceOfTruth = {
	cockpitMetrics:
		"Live ledger position balances plus accrual and cash-ledger summaries inside convex/portfolio",
	paymentActivityRows:
		"Obligations joined with mortgage context and latest collection/transfer state",
	historicalChartInputs:
		"Monthly portfolio history query backed by materialized snapshots with explicit live fallback labeling when a completed snapshot is missing",
	csvTaxExportInputs:
		"Server-generated lender tax export query backed by year-end snapshots and explicit live fallback when a completed-period snapshot is unavailable",
};
const PORTFOLIO_SUGGESTIONS_UNAVAILABLE_REASON =
	"FairLend could not load a reliable suggestion snapshot right now.";

function roundCurrency(value: number) {
	return Math.round(value * 100) / 100;
}

function centsToDollars(value: bigint | number) {
	return roundCurrency(Number(value) / 100);
}

function safeNumberFromBigInt(value: bigint, label: string) {
	if (
		value > BigInt(Number.MAX_SAFE_INTEGER) ||
		value < BigInt(Number.MIN_SAFE_INTEGER)
	) {
		throw new ConvexError(`${label} exceeds safe integer range`);
	}
	return Number(value);
}

function buildPropertyLabel(property: Doc<"properties"> | null) {
	if (!property) {
		return "Unknown property";
	}

	const unitPrefix = property.unit ? `${property.unit}-` : "";
	return `${unitPrefix}${property.streetAddress}, ${property.city}`;
}

function businessDateFromUnixMs(value: number | undefined | null) {
	return value == null ? null : unixMsToBusinessDate(value);
}

function daysUntilBusinessDate(date: string) {
	const now = Date.now();
	const then = new Date(`${date}T00:00:00.000Z`).getTime();
	return Math.floor((then - now) / MILLISECONDS_PER_DAY);
}

function buildRenewalTimingLabel(maturityDate: string) {
	const daysUntil = daysUntilBusinessDate(maturityDate);
	if (daysUntil < 0) {
		return `${Math.abs(daysUntil)} days overdue`;
	}
	if (daysUntil === 0) {
		return "Due today";
	}
	if (daysUntil === 1) {
		return "Due tomorrow";
	}
	return `Due in ${daysUntil} days`;
}

function balanceUnitsToFractions(balanceUnits: number) {
	return roundCurrency(balanceUnits / POSITION_UNITS_PER_FRACTION);
}

function balanceUnitsToPercent(balanceUnits: number) {
	return roundCurrency((balanceUnits / Number(TOTAL_SUPPLY)) * 100);
}

function calculateLenderShareAmount(balanceUnits: number, grossAmount: number) {
	return roundCurrency((balanceUnits / Number(TOTAL_SUPPLY)) * grossAmount);
}

function compareByPublishedAt(
	left: Pick<Doc<"listings">, "_id" | "publishedAt" | "updatedAt">,
	right: Pick<Doc<"listings">, "_id" | "publishedAt" | "updatedAt">
) {
	const leftPublishedAt = left.publishedAt ?? 0;
	const rightPublishedAt = right.publishedAt ?? 0;
	if (leftPublishedAt !== rightPublishedAt) {
		return rightPublishedAt - leftPublishedAt;
	}
	if (left.updatedAt !== right.updatedAt) {
		return right.updatedAt - left.updatedAt;
	}
	return String(left._id).localeCompare(String(right._id));
}

function compareByCreatedAtDesc(
	left: Pick<Doc<"deals">, "createdAt">,
	right: Pick<Doc<"deals">, "createdAt">
) {
	return right.createdAt - left.createdAt;
}

function buildMortgagePrefillContext(args: {
	mortgageId: string;
	propertyLabel: string;
	summary: string;
	title: string;
}): PortfolioBrokerPrefillContext {
	return {
		contextType: "mortgage",
		mortgageId: args.mortgageId,
		propertyLabel: args.propertyLabel,
		subjectId: args.mortgageId,
		summary: args.summary,
		title: args.title,
	};
}

function buildPaymentPrefillContext(args: {
	mortgageId: string;
	obligationId: string;
	propertyLabel: string;
	summary: string;
	title: string;
}): PortfolioBrokerPrefillContext {
	return {
		contextType: "payment",
		mortgageId: args.mortgageId,
		obligationId: args.obligationId,
		propertyLabel: args.propertyLabel,
		subjectId: args.obligationId,
		summary: args.summary,
		title: args.title,
	};
}

function buildDealPrefillContext(args: {
	dealId: string;
	mortgageId: string;
	propertyLabel: string;
	summary: string;
	title: string;
}): PortfolioBrokerPrefillContext {
	return {
		contextType: "deal",
		dealId: args.dealId,
		mortgageId: args.mortgageId,
		propertyLabel: args.propertyLabel,
		subjectId: args.dealId,
		summary: args.summary,
		title: args.title,
	};
}

function buildRowStatus(args: {
	latestAttempt: Doc<"collectionAttempts"> | null;
	latestTransfer: Doc<"transferRequests"> | null;
	obligation: Doc<"obligations">;
}) {
	if (
		args.latestAttempt?.status === "failed" ||
		args.latestTransfer?.status === "failed" ||
		args.obligation.status === "overdue"
	) {
		return "exception";
	}
	if (
		args.obligation.status === "settled" ||
		args.latestTransfer?.status === "confirmed"
	) {
		return "settled";
	}
	if (args.obligation.status === "due") {
		return "due";
	}
	if (args.obligation.status === "upcoming") {
		return "upcoming";
	}
	return args.obligation.status;
}

async function listActiveLenderPositionAccounts(
	ctx: Pick<QueryCtx, "db">,
	lenderAuthId: string
): Promise<ActiveLenderPositionAccount[]> {
	const indexedAccounts = await ctx.db
		.query("ledger_accounts")
		.withIndex("by_lender", (query) => query.eq("lenderId", lenderAuthId))
		.collect();
	const legacyAccounts =
		indexedAccounts.length === 0
			? (await ctx.db.query("ledger_accounts").collect()).filter(
					(account) =>
						account.type === "POSITION" &&
						getAccountLenderId(account) === lenderAuthId
				)
			: [];
	const dedupedAccounts = new Map<string, Doc<"ledger_accounts">>();
	for (const account of [...indexedAccounts, ...legacyAccounts]) {
		dedupedAccounts.set(String(account._id), account);
	}

	return [...dedupedAccounts.values()]
		.filter(
			(account) =>
				account.type === "POSITION" &&
				account.mortgageId !== undefined &&
				getPostedBalance(account) > 0n
		)
		.map((account) => ({
			accountId: account._id,
			balanceUnits: safeNumberFromBigInt(
				getPostedBalance(account),
				"position balance"
			),
			mortgageId: account.mortgageId as Id<"mortgages">,
		}));
}

async function loadMortgageMap(
	ctx: Pick<QueryCtx, "db">,
	mortgageIds: readonly Id<"mortgages">[]
) {
	const entries = await Promise.all(
		mortgageIds.map(async (mortgageId) => [
			mortgageId,
			await ctx.db.get(mortgageId),
		])
	);
	return new Map(
		entries.filter(
			(entry): entry is [Id<"mortgages">, Doc<"mortgages">] => entry[1] !== null
		)
	);
}

async function loadPropertyMap(
	ctx: Pick<QueryCtx, "db">,
	properties: readonly Id<"properties">[]
) {
	const entries = await Promise.all(
		properties.map(async (propertyId) => [
			propertyId,
			await ctx.db.get(propertyId),
		])
	);
	return new Map(
		entries.filter(
			(entry): entry is [Id<"properties">, Doc<"properties">] =>
				entry[1] !== null
		)
	);
}

async function loadListingByMortgageMap(
	ctx: Pick<QueryCtx, "db">,
	mortgageIds: readonly Id<"mortgages">[]
) {
	const entries = await Promise.all(
		mortgageIds.map(async (mortgageId) => {
			const listings = await ctx.db
				.query("listings")
				.withIndex("by_mortgage", (query) => query.eq("mortgageId", mortgageId))
				.collect();
			const listing =
				listings
					.filter((candidate) => candidate.status === "published")
					.sort(compareByPublishedAt)[0] ?? null;
			return [mortgageId, listing] as const;
		})
	);
	return new Map(entries);
}

async function loadRenewalIntentMap(
	ctx: Pick<QueryCtx, "db">,
	lenderId: Id<"lenders">
) {
	const intents = await ctx.db
		.query("lenderRenewalIntents")
		.withIndex("by_lender", (query) => query.eq("lenderId", lenderId))
		.collect();
	return new Map(intents.map((intent) => [String(intent.mortgageId), intent]));
}

async function loadOpenDealsByMortgageMap(
	ctx: Pick<QueryCtx, "db">,
	lenderId: Id<"lenders">
) {
	const deals = await ctx.db
		.query("deals")
		.withIndex("by_lender", (query) => query.eq("lenderId", lenderId))
		.collect();
	const openDeals = deals
		.filter((deal) => !["confirmed", "failed"].includes(deal.status))
		.sort(compareByCreatedAtDesc);
	return new Map(openDeals.map((deal) => [String(deal.mortgageId), deal]));
}

async function loadPaymentContextsForMortgage(
	ctx: Pick<QueryCtx, "db">,
	args: {
		balanceUnits: number;
		mortgage: Doc<"mortgages">;
		propertyLabel: string;
	}
): Promise<MortgagePaymentContext[]> {
	const [obligations, attempts] = await Promise.all([
		ctx.db
			.query("obligations")
			.withIndex("by_mortgage_and_date", (query) =>
				query.eq("mortgageId", args.mortgage._id)
			)
			.collect(),
		ctx.db
			.query("collectionAttempts")
			.withIndex("by_mortgage_status", (query) =>
				query.eq("mortgageId", args.mortgage._id)
			)
			.collect(),
	]);

	const latestAttemptByObligationId = new Map<
		string,
		Doc<"collectionAttempts">
	>();
	for (const attempt of attempts) {
		for (const obligationId of attempt.obligationIds) {
			const key = String(obligationId);
			const current = latestAttemptByObligationId.get(key);
			if (!current || attempt.initiatedAt > current.initiatedAt) {
				latestAttemptByObligationId.set(key, attempt);
			}
		}
	}

	const transfers = await ctx.db
		.query("transferRequests")
		.withIndex("by_mortgage", (query) =>
			query.eq("mortgageId", args.mortgage._id)
		)
		.collect();

	const latestTransferByObligationId = new Map<
		string,
		Doc<"transferRequests">
	>();
	for (const transfer of transfers) {
		if (!transfer.obligationId) {
			continue;
		}
		const key = String(transfer.obligationId);
		const current = latestTransferByObligationId.get(key);
		if (!current || transfer.createdAt > current.createdAt) {
			latestTransferByObligationId.set(key, transfer);
		}
	}

	return obligations
		.sort((left, right) => right.dueDate - left.dueDate)
		.map((obligation) => {
			const latestAttempt =
				latestAttemptByObligationId.get(String(obligation._id)) ?? null;
			const latestTransfer =
				latestTransferByObligationId.get(String(obligation._id)) ?? null;
			const row: PortfolioPaymentRow = {
				dueDate: unixMsToBusinessDate(obligation.dueDate),
				grossAmount: centsToDollars(obligation.amount),
				latestCollectionStatus: latestAttempt?.status ?? null,
				latestTransferStatus: latestTransfer?.status ?? null,
				lenderShareAmount: calculateLenderShareAmount(
					args.balanceUnits,
					centsToDollars(obligation.amount)
				),
				mortgageId: String(args.mortgage._id),
				obligationId: String(obligation._id),
				obligationStatus: obligation.status,
				paymentNumber: obligation.paymentNumber,
				propertyLabel: args.propertyLabel,
				rowStatus: buildRowStatus({
					latestAttempt,
					latestTransfer,
					obligation,
				}),
				type: obligation.type,
			};
			return { latestAttempt, latestTransfer, obligation, row };
		});
}

async function loadSuggestedOpportunityCandidates(
	ctx: PortfolioQueryContext,
	args: {
		filters: Parameters<typeof listMarketplaceListingsSnapshot>[1]["filters"];
		heldMortgageIds: ReadonlySet<string>;
		pricingPolicy: Pick<PortalPricingPolicyDoc, "brokerSplitPercent"> | null;
	}
): Promise<{
	excludedOwnedMortgageCount: number;
	rows: MarketplaceSuggestionRow[];
}> {
	const candidates = await collectMarketplaceListingCandidates(
		ctx,
		args.filters
	);
	const filtered = candidates
		.filter((listing) => matchesMarketplaceFilters(listing, args.filters))
		.sort(compareMarketplaceListings);

	let excludedOwnedMortgageCount = 0;
	const selectedListings: Doc<"listings">[] = [];

	for (const listing of filtered) {
		if (
			listing.mortgageId &&
			args.heldMortgageIds.has(String(listing.mortgageId))
		) {
			excludedOwnedMortgageCount += 1;
			continue;
		}
		selectedListings.push(listing);
		if (selectedListings.length >= SUGGESTED_OPPORTUNITY_LIMIT) {
			break;
		}
	}

	const withAvailability = await attachMarketplaceAvailabilityToListings(
		ctx,
		selectedListings
	);

	const rows = await Promise.all(
		withAvailability.map(async ({ availability, listing }) => {
			const projectedListing = args.pricingPolicy
				? projectListingForPortal(listing, args.pricingPolicy)
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
				title: projectedListing.title ?? "Mortgage Listing",
			};
		})
	);

	return { excludedOwnedMortgageCount, rows };
}

async function buildSuggestedOpportunitiesSection(
	ctx: PortfolioQueryContext,
	args: {
		effectiveFilters: Parameters<
			typeof listMarketplaceListingsSnapshot
		>[1]["filters"];
		generatedAt: number;
		heldMortgageIds: ReadonlySet<string>;
		heldMortgageTypes: Set<string>;
		heldPropertyTypes: Set<string>;
		interestRateBenchmark: number;
	}
): Promise<{
	section: PortfolioSuggestedOpportunitiesSection;
	suggestionSeedCount: number;
}> {
	try {
		const pricingSelection = await loadPortalPricingSelection(ctx, {
			atTime: args.generatedAt,
			portalId: ctx.portal.portalId,
		});
			const { excludedOwnedMortgageCount, rows: suggestedOpportunityCandidates } =
				await loadSuggestedOpportunityCandidates(ctx, {
					filters: args.effectiveFilters,
					heldMortgageIds: args.heldMortgageIds,
					pricingPolicy:
						pricingSelection.kind === "ready" ? pricingSelection.policy : null,
				});
			const rows: PortfolioSuggestedOpportunity[] =
				suggestedOpportunityCandidates.map((suggestion) => ({
					explanationTags: buildSuggestionReasonTags({
						heldMortgageTypes: args.heldMortgageTypes,
						heldPropertyTypes: args.heldPropertyTypes,
						interestRateBenchmark: args.interestRateBenchmark,
						interestRate: suggestion.interestRate,
						mortgageType: suggestion.mortgageTypeLabel,
						propertyType: suggestion.propertyTypeLabel,
					}),
					heroImageUrl: suggestion.heroImageUrl,
					interestRate: suggestion.interestRate,
					listingId: suggestion.id,
					locationLabel: suggestion.locationLabel,
					ltvRatio: suggestion.ltvRatio,
					marketplaceCopy: suggestion.marketplaceCopy,
					maturityDate: suggestion.maturityDate,
					mortgageId: suggestion.mortgageId,
					mortgageTypeLabel: suggestion.mortgageTypeLabel,
					principal: suggestion.principal,
					propertyTypeLabel: suggestion.propertyTypeLabel,
					title: suggestion.title,
				}));

		return {
			section: {
				availabilityState: "ready",
				excludedOwnedMortgageCount,
				rows,
			},
			suggestionSeedCount: suggestedOpportunityCandidates.length,
		};
	} catch (error) {
		console.error("Failed to build portfolio suggested opportunities", error);
		return {
			section: {
				availabilityState: "unavailable",
				excludedOwnedMortgageCount: 0,
				rows: [],
				unavailableReason: PORTFOLIO_SUGGESTIONS_UNAVAILABLE_REASON,
			},
			suggestionSeedCount: 0,
		};
	}
}

function buildSuggestionReasonTags(args: {
	heldMortgageTypes: Set<string>;
	heldPropertyTypes: Set<string>;
	interestRateBenchmark: number;
	interestRate: number;
	mortgageType: string;
	propertyType: string | undefined;
}) {
	const tags: PortfolioSuggestionReasonTag[] = [];

	if (args.propertyType && args.heldPropertyTypes.has(args.propertyType)) {
		tags.push({
			label: "Property fit",
			reason:
				"Matches a property type already present in the current portfolio",
		});
	}

	if (args.heldMortgageTypes.has(args.mortgageType)) {
		tags.push({
			label: "Mortgage fit",
			reason: "Aligns with the lien profile already held by the lender",
		});
	}

	if (args.interestRate >= args.interestRateBenchmark) {
		tags.push({
			label: "Yield",
			reason: "Meets or exceeds the current portfolio weighted-rate benchmark",
		});
	}

	if (tags.length === 0) {
		tags.push({
			label: "Broker limits",
			reason:
				"Fits the broker-imposed portfolio constraints published by the server",
		});
	}

	return tags.slice(0, 3);
}

async function buildBrokerSummary(
	ctx: Pick<QueryCtx, "db">,
	brokerId: Id<"brokers"> | undefined
): Promise<PortfolioBrokerSummary> {
	if (!brokerId) {
		return null;
	}

	const broker = await ctx.db.get(brokerId);
	if (!broker) {
		return null;
	}

	const brokerUser = await ctx.db.get(broker.userId);
	if (!brokerUser) {
		return null;
	}

	return {
		brokerId: String(broker._id),
		brokerageName: broker.brokerageName ?? null,
		email: brokerUser.email ?? null,
		name: [brokerUser.firstName, brokerUser.lastName].filter(Boolean).join(" "),
		phoneNumber: brokerUser.phoneNumber ?? null,
	};
}

function buildBrokerContactCta(broker: PortfolioBrokerSummary) {
	if (!broker) {
		return null;
	}
	if (broker.email) {
		return {
			label: "Email assigned broker",
			mode: "email" as const,
			value: broker.email,
		};
	}
	if (broker.phoneNumber) {
		return {
			label: "Call assigned broker",
			mode: "phone" as const,
			value: broker.phoneNumber,
		};
	}
	return {
		label: "View assigned broker",
		mode: "profile" as const,
		value: broker.brokerId,
	};
}

function buildPortfolioRow(
	args: {
		listing: Doc<"listings"> | null;
		mortgage: Doc<"mortgages">;
		nextPayment: MortgagePaymentContext | null;
		property: Doc<"properties"> | null;
		renewalIntent: Doc<"lenderRenewalIntents"> | null;
	},
	position: ActiveLenderPositionAccount
): PortfolioPositionRow {
	return {
		estimatedPositionValue: calculateLenderShareAmount(
			position.balanceUnits,
			args.mortgage.principal
		),
		fractionCount: balanceUnitsToFractions(position.balanceUnits),
		lenderSharePaymentAmount: args.nextPayment
			? args.nextPayment.row.lenderShareAmount
			: 0,
		mortgageId: String(args.mortgage._id),
		mortgageStatus: args.mortgage.status,
		nextPaymentDate: args.nextPayment?.row.dueDate ?? null,
		paymentAmount: args.mortgage.paymentAmount,
		positionPercent: balanceUnitsToPercent(position.balanceUnits),
		positionUnits: position.balanceUnits,
		propertyLabel: buildPropertyLabel(args.property),
		renewalIntentStatus: args.renewalIntent?.status ?? null,
		renewalTimingLabel: buildRenewalTimingLabel(args.mortgage.maturityDate),
		thumbnailUrl: null,
	};
}

async function withThumbnailUrl(
	ctx: Pick<QueryCtx, "storage">,
	row: PortfolioPositionRow,
	listing: Doc<"listings"> | null
) {
	return {
		...row,
		thumbnailUrl: listing
			? await getHeroImageUrl(ctx, listing.heroImages[0])
			: null,
	};
}

function buildPaymentExceptionAction(
	row: PortfolioPaymentRow
): PortfolioActionItem {
	return {
		dueDate: row.dueDate,
		id: `payment-${row.obligationId}`,
		kind: "payment_exception",
		mortgageId: row.mortgageId,
		obligationId: row.obligationId,
		prefillContext: buildPaymentPrefillContext({
			mortgageId: row.mortgageId,
			obligationId: row.obligationId,
			propertyLabel: row.propertyLabel,
			summary: `Payment ${row.paymentNumber} is currently ${row.rowStatus}`,
			title: `Payment ${row.paymentNumber} follow-up`,
		}),
		priority: "high",
		status: row.rowStatus,
		summary: `${row.propertyLabel} payment ${row.paymentNumber} requires servicing follow-up`,
		title: "Payment follow-up required",
	};
}

function buildRenewalAction(args: {
	intent: Doc<"lenderRenewalIntents">;
	propertyLabel: string;
}): PortfolioActionItem {
	const renewalIntentSummary = args.intent.intent ?? "awaiting lender decision";

	return {
		dueDate: businessDateFromUnixMs(args.intent.signalDeadline),
		id: `renewal-${String(args.intent._id)}`,
		kind: "renewal_prompt",
		mortgageId: String(args.intent.mortgageId),
		prefillContext: buildMortgagePrefillContext({
			mortgageId: String(args.intent.mortgageId),
			propertyLabel: args.propertyLabel,
			summary: `Renewal intent is ${renewalIntentSummary} with status ${args.intent.status}`,
			title: "Renewal coordination",
		}),
		priority: "medium",
		status: args.intent.status,
		summary: `${args.propertyLabel} needs renewal coordination`,
		title: "Renewal attention",
	};
}

function buildDealAction(args: {
	deal: Doc<"deals">;
	propertyLabel: string;
}): PortfolioActionItem {
	return {
		dealId: String(args.deal._id),
		dueDate: businessDateFromUnixMs(args.deal.closingDate ?? null),
		id: `deal-${String(args.deal._id)}`,
		kind: "deal_action",
		mortgageId: String(args.deal.mortgageId),
		prefillContext: buildDealPrefillContext({
			dealId: String(args.deal._id),
			mortgageId: String(args.deal.mortgageId),
			propertyLabel: args.propertyLabel,
			summary: `Deal is currently ${args.deal.status}`,
			title: "Deal coordination",
		}),
		priority: "medium",
		status: args.deal.status,
		summary: `${args.propertyLabel} has an active lender deal in progress`,
		title: "Deal action required",
	};
}

function buildBrokerMessageAction(args: {
	mortgageId: string;
	propertyLabel: string;
	title: string;
	summary: string;
}): PortfolioActionItem {
	return {
		id: `broker-${args.mortgageId}-${args.title.toLowerCase().replace(/\s+/g, "-")}`,
		kind: "broker_message",
		mortgageId: args.mortgageId,
		prefillContext: buildMortgagePrefillContext({
			mortgageId: args.mortgageId,
			propertyLabel: args.propertyLabel,
			summary: args.summary,
			title: args.title,
		}),
		priority: "low",
		status: "ready",
		summary: args.summary,
		title: args.title,
		dueDate: null,
	};
}

function buildPaymentTimeline(args: {
	latestAttempt: Doc<"collectionAttempts"> | null;
	latestTransfer: Doc<"transferRequests"> | null;
	obligation: Doc<"obligations">;
}): PortfolioTimelineEvent[] {
	const events: Array<{ label: string; status: string; timestamp: number }> = [
		{
			label: "Payment scheduled",
			status: args.obligation.status,
			timestamp: args.obligation.dueDate,
		},
	];

	if (args.latestAttempt?.initiatedAt) {
		events.push({
			label: "Collection attempt created",
			status: args.latestAttempt.status,
			timestamp: args.latestAttempt.initiatedAt,
		});
	}

	if (args.latestTransfer?.createdAt) {
		events.push({
			label: "Transfer request created",
			status: args.latestTransfer.status,
			timestamp: args.latestTransfer.createdAt,
		});
	}

	if (args.obligation.settledAt) {
		events.push({
			label: "Payment settled",
			status: "settled",
			timestamp: args.obligation.settledAt,
		});
	}

	return events
		.sort((left, right) => right.timestamp - left.timestamp)
		.map((event) => ({
			label: event.label,
			status: event.status,
			timestampLabel: unixMsToBusinessDate(event.timestamp),
		}));
}

function startOfMonthBusinessDate() {
	const now = new Date();
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
		.toISOString()
		.slice(0, 10);
}

function startOfYearBusinessDate() {
	const now = new Date();
	return new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
		.toISOString()
		.slice(0, 10);
}

function getPropertyForMortgage(
	mortgageMap: Map<Id<"mortgages">, Doc<"mortgages">>,
	propertyMap: Map<Id<"properties">, Doc<"properties">>,
	mortgageId: Id<"mortgages">
) {
	const mortgage = mortgageMap.get(mortgageId);
	if (!mortgage) {
		return null;
	}

	return propertyMap.get(mortgage.propertyId) ?? null;
}

function getPrimaryBrokerId(mortgages: Iterable<Doc<"mortgages">>) {
	for (const mortgage of mortgages) {
		if (mortgage.assignedBrokerId) {
			return mortgage.assignedBrokerId;
		}
		if (mortgage.brokerOfRecordId) {
			return mortgage.brokerOfRecordId;
		}
	}

	return undefined;
}

function accumulateBreakdown(
	rows: Array<{ count: number; key: string; positionUnits: number }>,
	key: string,
	positionUnits: number
) {
	const current = rows.find((row) => row.key === key);
	if (current) {
		current.count += 1;
		current.positionUnits += positionUnits;
		return rows;
	}

	rows.push({ count: 1, key, positionUnits });
	return rows;
}

export async function buildPortfolioCommandCenter(
	ctx: PortfolioQueryContext
): Promise<PortfolioCommandCenter> {
	const generatedAt = Date.now();
	const today = unixMsToBusinessDate(generatedAt);
	const positions = await listActiveLenderPositionAccounts(
		ctx,
		ctx.viewer.authId
	);
	const mortgageIds = positions.map((position) => position.mortgageId);
	const mortgageMap = await loadMortgageMap(ctx, mortgageIds);
	const propertyMap = await loadPropertyMap(ctx, [
		...new Set(
			[...mortgageMap.values()].map((mortgage) => mortgage.propertyId)
		),
	]);
	const listingByMortgageMap = await loadListingByMortgageMap(ctx, mortgageIds);
	const renewalIntentMap = await loadRenewalIntentMap(ctx, ctx.lender._id);
	const openDealsByMortgageMap = await loadOpenDealsByMortgageMap(
		ctx,
		ctx.lender._id
	);

	const positionRows = await Promise.all(
		positions.map(async (position) => {
			const mortgage = mortgageMap.get(position.mortgageId);
			if (!mortgage) {
				throw new ConvexError("Lender position mortgage is missing");
			}
			const property = propertyMap.get(mortgage.propertyId) ?? null;
			const paymentContexts = await loadPaymentContextsForMortgage(ctx, {
				balanceUnits: position.balanceUnits,
				mortgage,
				propertyLabel: buildPropertyLabel(property),
			});
			const nextPayment =
				[...paymentContexts]
					.filter((context) => context.obligation.status !== "settled")
					.sort(
						(left, right) => left.obligation.dueDate - right.obligation.dueDate
					)[0] ?? null;
			const baseRow = buildPortfolioRow(
				{
					listing: listingByMortgageMap.get(position.mortgageId) ?? null,
					mortgage,
					nextPayment,
					property,
					renewalIntent:
						renewalIntentMap.get(String(position.mortgageId)) ?? null,
				},
				position
			);
			return {
				paymentContexts,
				row: await withThumbnailUrl(
					ctx,
					baseRow,
					listingByMortgageMap.get(position.mortgageId) ?? null
				),
			};
		})
	);

	const allPaymentContexts = positionRows.flatMap(
		(entry) => entry.paymentContexts
	);
	const paymentRows = allPaymentContexts
		.map((context) => context.row)
		.sort((left, right) => right.dueDate.localeCompare(left.dueDate));

	const paymentExceptionActions = paymentRows
		.filter((row) => row.rowStatus === "exception")
		.map(buildPaymentExceptionAction);

	const renewalActions = [...renewalIntentMap.values()].map((intent) =>
		buildRenewalAction({
			intent,
			propertyLabel: buildPropertyLabel(
				getPropertyForMortgage(mortgageMap, propertyMap, intent.mortgageId)
			),
		})
	);

	const dealActions = [...openDealsByMortgageMap.values()].map((deal) => {
		const mortgage = mortgageMap.get(deal.mortgageId) ?? null;
		const property = mortgage
			? (propertyMap.get(mortgage.propertyId) ?? null)
			: null;
		return buildDealAction({
			deal,
			propertyLabel: buildPropertyLabel(property),
		});
	});

	const actionItems = [
		...paymentExceptionActions,
		...renewalActions,
		...dealActions,
	].sort((left, right) => {
		const priorityWeight = { high: 0, medium: 1, low: 2 } as const;
		const priorityCompare =
			priorityWeight[left.priority] - priorityWeight[right.priority];
		if (priorityCompare !== 0) {
			return priorityCompare;
		}
		return (left.dueDate ?? "").localeCompare(right.dueDate ?? "");
	});

	const monthlyAccrual = await buildPortfolioAccrualBreakdown(
		ctx,
		ctx.viewer.authId,
		startOfMonthBusinessDate(),
		today
	);
	const ytdAccrual = await buildPortfolioAccrualBreakdown(
		ctx,
		ctx.viewer.authId,
		startOfYearBusinessDate(),
		today
	);
	const lifetimeFromDate =
		[...mortgageMap.values()]
			.map((mortgage) => mortgage.termStartDate)
			.sort()[0] ?? today;
	const lifetimeAccrual = await buildPortfolioAccrualBreakdown(
		ctx,
		ctx.viewer.authId,
		lifetimeFromDate,
		today
	);
	const availableCashBalance = await getAvailableLenderPayableBalanceImpl(
		ctx,
		ctx.lender._id
	);
	const undisbursedEntries = await ctx.db
		.query("dispersalEntries")
		.withIndex("by_lender", (query) => query.eq("lenderId", ctx.lender._id))
		.collect();
	const undisbursedBalance = roundCurrency(
		undisbursedEntries
			.filter((entry) => entry.status === "pending")
			.reduce((sum, entry) => sum + entry.amount, 0) / 100
	);

	const constraint = await loadLenderFilterConstraint(ctx, {
		brokerId: ctx.portal.brokerId,
		lenderId: ctx.lender._id,
	});
	const effectiveFilters = clampMarketplaceFiltersToLenderConstraints(
		undefined,
		constraint
	);
	const heldMortgageIds = new Set(
		mortgageIds.map((mortgageId) => String(mortgageId))
	);
	const heldPropertyTypes = new Set<string>(
		positions
			.map((position) => {
				const listing = listingByMortgageMap.get(position.mortgageId);
				if (listing) {
					return listing.marketplacePropertyType;
				}

				const property = getPropertyForMortgage(
					mortgageMap,
					propertyMap,
					position.mortgageId
				);
				return property
					? deriveMarketplacePropertyType(property.propertyType)
					: undefined;
			})
			.filter(
				(
					value
				): value is Exclude<
					Doc<"listings">["marketplacePropertyType"],
					undefined
				> => value !== undefined
			)
	);
	const heldMortgageTypes = new Set(
		[...mortgageMap.values()].map((mortgage) =>
			lienPositionToMortgageType(mortgage.lienPosition)
		)
	);
	const weightedRateDenominator = positions.reduce(
		(total, position) => total + position.balanceUnits,
		0
	);
	const weightedAverageInterestRate =
		weightedRateDenominator === 0
			? 0
			: roundCurrency(
					positions.reduce((total, position) => {
						const mortgage = mortgageMap.get(position.mortgageId);
						return (
							total + (mortgage?.interestRate ?? 0) * position.balanceUnits
						);
					}, 0) / weightedRateDenominator
				);
	const { section: suggestedOpportunities, suggestionSeedCount } =
		await buildSuggestedOpportunitiesSection(ctx, {
			effectiveFilters,
			generatedAt,
			heldMortgageIds,
			heldMortgageTypes,
			heldPropertyTypes,
			interestRateBenchmark: weightedAverageInterestRate,
		});

	const primaryBrokerId =
		ctx.portal.brokerId ?? getPrimaryBrokerId(mortgageMap.values());
	const assignedBroker = await buildBrokerSummary(ctx, primaryBrokerId);

	return {
		actionsRequired: {
			allClear: actionItems.length === 0,
			items: actionItems,
		},
		brokerCoordination: {
			assignedBroker,
			availabilityState: assignedBroker
				? "fallback_contact_only"
				: "missing_broker",
			fallbackContactCta: buildBrokerContactCta(assignedBroker),
			prefillContextPayloads: {
				dealFollowUps: dealActions
					.map((action) => action.prefillContext)
					.slice(0, 3),
				mortgageFollowUps: renewalActions
					.map((action) => action.prefillContext)
					.slice(0, 3),
				paymentFollowUps: paymentExceptionActions
					.map((action) => action.prefillContext)
					.slice(0, 3),
			},
			threadId: null,
		},
		cockpit: {
			breakdowns: {
				byMortgageStatus: (() => {
					const positionBalanceByMortgageId = new Map<string, number>();
					for (const position of positions) {
						positionBalanceByMortgageId.set(
							String(position.mortgageId),
							position.balanceUnits
						);
					}
					return [...mortgageMap.values()].reduce<
						Array<{ count: number; key: string; positionUnits: number }>
					>((rows, mortgage) => {
						const positionUnits =
							positionBalanceByMortgageId.get(String(mortgage._id)) ?? 0;
						return accumulateBreakdown(rows, mortgage.status, positionUnits);
					}, []);
				})(),
				byPropertyType: positions.reduce<
					Array<{ count: number; key: string; positionUnits: number }>
				>((rows, position) => {
					const property = getPropertyForMortgage(
						mortgageMap,
						propertyMap,
						position.mortgageId
					);
					return accumulateBreakdown(
						rows,
						property?.propertyType ?? "unknown",
						position.balanceUnits
					);
				}, []),
			},
			metrics: {
				activeDealCount: dealActions.length,
				activePositionCount: positions.length,
				availableCashBalance: centsToDollars(
					availableCashBalance.availableBalance
				),
				estimatedPortfolioValue: roundCurrency(
					positionRows.reduce(
						(total, positionRow) =>
							total + positionRow.row.estimatedPositionValue,
						0
					)
				),
				lifetimeAccruedInterest: roundCurrency(lifetimeAccrual.accruedInterest),
				monthlyAccruedInterest: roundCurrency(monthlyAccrual.accruedInterest),
				paymentExceptionCount: paymentExceptionActions.length,
				renewalsDueSoonCount: renewalActions.length,
				totalFractions: roundCurrency(
					positionRows.reduce(
						(total, positionRow) => total + positionRow.row.fractionCount,
						0
					)
				),
				totalPositionUnits: positions.reduce(
					(total, position) => total + position.balanceUnits,
					0
				),
				undisbursedBalance,
				weightedAverageInterestRate,
				ytdAccruedInterest: roundCurrency(ytdAccrual.accruedInterest),
			},
		},
		emptyStates: {
			hasActions: actionItems.length > 0,
			hasPayments: paymentRows.length > 0,
			hasPositions: positionRows.length > 0,
			hasSuggestions: suggestedOpportunities.rows.length > 0,
		},
		generatedAt,
		limitsStrip: {
			constraints: {
				allowedMortgageTypes: constraint?.allowedMortgageTypes ?? [],
				allowedPropertyTypes: constraint?.allowedPropertyTypes ?? [],
				interestRateRange: constraint?.interestRateRange ?? null,
				loanAmountRange: constraint?.loanAmountRange ?? null,
				ltvRange: constraint?.ltvRange ?? null,
				maturityDateMax: constraint?.maturityDateMax ?? null,
				updatedAt: constraint?.updatedAt ?? null,
			},
			effectiveFilters: effectiveFilters ?? null,
			hasConstraints: constraint !== null,
			suggestionSeedCount,
		},
		paymentActivity: {
			rows: paymentRows,
		},
		positions: {
			rows: positionRows.map((entry) => entry.row),
		},
		sourceOfTruth: PORTFOLIO_SOURCE_OF_TRUTH,
		suggestedOpportunities,
	};
}

async function loadOwnedPositionForMortgage(
	ctx: PortfolioQueryContext,
	mortgageId: Id<"mortgages">
) {
	const positions = await listActiveLenderPositionAccounts(
		ctx,
		ctx.viewer.authId
	);
	return (
		positions.find((position) => position.mortgageId === mortgageId) ?? null
	);
}

export async function buildPortfolioPositionDetail(
	ctx: PortfolioQueryContext,
	mortgageId: Id<"mortgages">
): Promise<PortfolioPositionDetail> {
	const position = await loadOwnedPositionForMortgage(ctx, mortgageId);
	if (!position) {
		throw new ConvexError("Portfolio position not found");
	}

	const mortgage = await ctx.db.get(mortgageId);
	if (!mortgage) {
		throw new ConvexError("Mortgage not found");
	}
	const property = await ctx.db.get(mortgage.propertyId);
	const listingMap = await loadListingByMortgageMap(ctx, [mortgageId]);
	const listing = listingMap.get(mortgageId) ?? null;
	const renewalIntentMap = await loadRenewalIntentMap(ctx, ctx.lender._id);
	const paymentContexts = await loadPaymentContextsForMortgage(ctx, {
		balanceUnits: position.balanceUnits,
		mortgage,
		propertyLabel: buildPropertyLabel(property),
	});
	const nextPayment =
		[...paymentContexts]
			.filter((context) => context.obligation.status !== "settled")
			.sort(
				(left, right) => left.obligation.dueDate - right.obligation.dueDate
			)[0] ?? null;
	const positionRow = await withThumbnailUrl(
		ctx,
		buildPortfolioRow(
			{
				listing,
				mortgage,
				nextPayment,
				property,
				renewalIntent: renewalIntentMap.get(String(mortgageId)) ?? null,
			},
			position
		),
		listing
	);
	const openDealMap = await loadOpenDealsByMortgageMap(ctx, ctx.lender._id);
	const openDeal = openDealMap.get(String(mortgageId)) ?? null;
	const quickActions: PortfolioActionItem[] = [
		buildBrokerMessageAction({
			mortgageId: String(mortgageId),
			propertyLabel: positionRow.propertyLabel,
			summary: `Discuss ${positionRow.propertyLabel} with the assigned broker`,
			title: "Message broker",
		}),
	];
	const renewalIntent = renewalIntentMap.get(String(mortgageId)) ?? null;
	if (renewalIntent) {
		quickActions.push(
			buildRenewalAction({
				intent: renewalIntent,
				propertyLabel: positionRow.propertyLabel,
			})
		);
	}
	if (openDeal) {
		quickActions.push(
			buildDealAction({
				deal: openDeal,
				propertyLabel: positionRow.propertyLabel,
			})
		);
	}

	return {
		generatedAt: Date.now(),
		mortgage: {
			amortizationMonths: mortgage.amortizationMonths,
			firstPaymentDate: mortgage.firstPaymentDate,
			interestRate: mortgage.interestRate,
			lienPosition: mortgage.lienPosition,
			maturityDate: mortgage.maturityDate,
			mortgageId: String(mortgage._id),
			paymentAmount: mortgage.paymentAmount,
			paymentFrequency: mortgage.paymentFrequency,
			principal: mortgage.principal,
			rateType: mortgage.rateType,
			status: mortgage.status,
			termMonths: mortgage.termMonths,
		},
		paymentOverview: {
			lenderSharePaymentAmount: positionRow.lenderSharePaymentAmount,
			nextPaymentDate: positionRow.nextPaymentDate,
		},
		position: positionRow,
		property: {
			city: property?.city ?? "",
			heroImageUrl: listing
				? await getHeroImageUrl(ctx, listing.heroImages[0])
				: null,
			postalCode: property?.postalCode ?? "",
			propertyType: property?.propertyType ?? "unknown",
			province: property?.province ?? "",
			streetAddress: property?.streetAddress ?? "",
			unit: property?.unit ?? null,
		},
		quickActions,
		renewal: {
			brokerAcknowledgedAt: renewalIntent?.brokerAcknowledgedAt ?? null,
			intent: renewalIntent?.intent ?? null,
			partialExitFractions: renewalIntent?.partialExitFractions ?? null,
			signalDeadline: businessDateFromUnixMs(
				renewalIntent?.signalDeadline ?? null
			),
			status: renewalIntent?.status ?? null,
		},
	};
}

export async function buildPortfolioPaymentDetail(
	ctx: PortfolioQueryContext,
	obligationId: Id<"obligations">
): Promise<PortfolioPaymentDetail> {
	const obligation = await ctx.db.get(obligationId);
	if (!obligation) {
		throw new ConvexError("Portfolio payment not found");
	}

	const position = await loadOwnedPositionForMortgage(
		ctx,
		obligation.mortgageId
	);
	if (!position) {
		throw new ConvexError("Portfolio payment not found");
	}

	const mortgage = await ctx.db.get(obligation.mortgageId);
	if (!mortgage) {
		throw new ConvexError("Mortgage not found");
	}
	const property = await ctx.db.get(mortgage.propertyId);
	const paymentContexts = await loadPaymentContextsForMortgage(ctx, {
		balanceUnits: position.balanceUnits,
		mortgage,
		propertyLabel: buildPropertyLabel(property),
	});
	const paymentContext =
		paymentContexts.find(
			(context) => context.obligation._id === obligationId
		) ?? null;
	if (!paymentContext) {
		throw new ConvexError("Portfolio payment not found");
	}

	const relatedActions: PortfolioActionItem[] = [
		buildBrokerMessageAction({
			mortgageId: String(mortgage._id),
			propertyLabel: paymentContext.row.propertyLabel,
			summary: `Discuss payment ${paymentContext.row.paymentNumber} with the assigned broker`,
			title: "Message broker",
		}),
	];
	if (paymentContext.row.rowStatus === "exception") {
		relatedActions.push(buildPaymentExceptionAction(paymentContext.row));
	}

	return {
		collectionTimeline: buildPaymentTimeline({
			latestAttempt: paymentContext.latestAttempt,
			latestTransfer: paymentContext.latestTransfer,
			obligation,
		}),
		generatedAt: Date.now(),
		mortgage: {
			interestRate: mortgage.interestRate,
			maturityDate: mortgage.maturityDate,
			mortgageId: String(mortgage._id),
			paymentAmount: mortgage.paymentAmount,
			paymentFrequency: mortgage.paymentFrequency,
			principal: mortgage.principal,
			status: mortgage.status,
		},
		payment: paymentContext.row,
		positionSummary: {
			estimatedPositionValue: calculateLenderShareAmount(
				position.balanceUnits,
				mortgage.principal
			),
			lenderSharePercent: balanceUnitsToPercent(position.balanceUnits),
			positionUnits: position.balanceUnits,
		},
		property: {
			city: property?.city ?? "",
			propertyType: property?.propertyType ?? "unknown",
			province: property?.province ?? "",
			streetAddress: property?.streetAddress ?? "",
			unit: property?.unit ?? null,
		},
		relatedActions,
	};
}
