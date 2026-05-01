import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { getLenderByAuthId } from "../auth/actorResolution";
import { authedQuery, requirePermission } from "../fluent";
import { getPostedBalance } from "../ledger/accounts";
import { TOTAL_SUPPLY } from "../ledger/constants";
import { unixMsToBusinessDate } from "../lib/businessDates";
import { getHeroImageUrl } from "../listings/marketplaceShared";
import { resolveMicPortalConfig } from "../portals/micConfig";
import {
	type MicAuditHistoryRow,
	type MicConcentrationExposureData,
	type MicDashboardSnapshot,
	type MicDealHistoryRow,
	type MicLendingFeeMetrics,
	type MicListingHeroImage,
	type MicMaturityLadderBucket,
	type MicPaymentHistoryRow,
	type MicPortfolioDataCompleteness,
	type MicPortfolioMetrics,
	type MicPortfolioSourceOfTruth,
	type MicPositionCurrentPayment,
	type MicPositionDetailData,
	type MicPositionFilters,
	type MicPositionRow,
	type MicReturnSeriesRow,
	type MicTransferHistoryRow,
	micConcentrationExposureResultValidator,
	micDashboardSnapshotValidator,
	micPaymentsHistoryResultValidator,
	micPositionDetailResultValidator,
	micPositionFiltersValidator,
	micPositionsResultValidator,
} from "./contracts";

const MIC_SOURCE_OF_TRUTH: MicPortfolioSourceOfTruth =
	"mortgage_ledger_lender_participation";
const CASH_LEDGER_WARNING =
	"MIC treasury, reserve, cash-on-hand, NAV, and personalized investor metrics are intentionally omitted until complete cash-ledger coverage exists.";
const DEAL_TERMINAL_STATUSES = new Set<string>(["confirmed", "failed"]);
const MIC_DEAL_HISTORY_CAP = 50;
const MIC_TRANSFER_HISTORY_CAP = 50;
const MIC_AUDIT_HISTORY_CAP = 50;
const MIC_ONGOING_DEALS_CAP = 20;
const INFERRED_LENDING_FEE_BASIS_POINTS = 100;

interface MicPositionAccount {
	accountId: Id<"ledger_accounts">;
	balanceUnits: number;
	mortgageId: Id<"mortgages">;
}

interface MicPositionProjection {
	listing: Doc<"listings"> | null;
	mortgage: Doc<"mortgages">;
	payments: MicPaymentHistoryRow[];
	position: MicPositionAccount;
	property: Doc<"properties">;
	row: MicPositionRow;
}

interface MicPortfolioProjection {
	concentration: MicConcentrationExposureData;
	dataCompleteness: MicPortfolioDataCompleteness;
	generatedAt: number;
	lendingFeeMetrics: MicLendingFeeMetrics;
	maturityLadder: MicMaturityLadderBucket[];
	metrics: MicPortfolioMetrics;
	positions: MicPositionProjection[];
	returnSeries: MicReturnSeriesRow[];
	warnings: string[];
}

type MicPortfolioCtx = Pick<QueryCtx, "db" | "storage">;

function centsToDollars(value: number) {
	return roundCurrency(value / 100);
}

function roundCurrency(value: number) {
	return Math.round(value * 100) / 100;
}

function roundPercent(value: number) {
	return Math.round(value * 100) / 100;
}

function calculateSharePercent(part: number, whole: number) {
	return whole <= 0 ? null : roundPercent((part / whole) * 100);
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

function calculateMicShareAmount(balanceUnits: number, grossAmount: number) {
	return roundCurrency((balanceUnits / Number(TOTAL_SUPPLY)) * grossAmount);
}

function buildPropertyLabel(property: Doc<"properties">) {
	const unitPrefix = property.unit ? `${property.unit}-` : "";
	return `${unitPrefix}${property.streetAddress}, ${property.city}`;
}

function toNullableString(value: string | undefined) {
	return value ?? null;
}

function monthPeriodFromBusinessDate(date: string) {
	return date.slice(0, 7);
}

function previousMonthPeriodFromBusinessDate(date: string) {
	const parsed = new Date(`${date}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime())) {
		return monthPeriodFromBusinessDate(date);
	}
	parsed.setUTCMonth(parsed.getUTCMonth() - 1);
	return parsed.toISOString().slice(0, 7);
}

function maturityBucket(
	maturityDate: string,
	generatedAt: number
): MicMaturityLadderBucket["bucket"] {
	const maturityTime = Date.parse(`${maturityDate}T00:00:00.000Z`);
	if (Number.isNaN(maturityTime)) {
		return "unknown";
	}
	const daysUntil = Math.floor(
		(maturityTime - generatedAt) / (1000 * 60 * 60 * 24)
	);
	if (daysUntil < 0) {
		return "past_due";
	}
	if (daysUntil <= 183) {
		return "0_6_months";
	}
	if (daysUntil <= 366) {
		return "6_12_months";
	}
	if (daysUntil <= 732) {
		return "12_24_months";
	}
	return "24_plus_months";
}

function emptyConcentration(): MicConcentrationExposureData {
	return {
		byBorrower: [],
		byGeography: [],
		byPropertyType: [],
		byStatus: [],
	};
}

function addConcentration(
	rows: MicConcentrationExposureData[keyof MicConcentrationExposureData],
	args: {
		key: string;
		label: string;
		outstandingPrincipal: number;
		totalOutstandingPrincipal: number;
	}
) {
	const existing = rows.find((row) => row.key === args.key);
	if (existing) {
		existing.count += 1;
		existing.outstandingPrincipal = roundCurrency(
			existing.outstandingPrincipal + args.outstandingPrincipal
		);
		existing.sharePercent =
			args.totalOutstandingPrincipal === 0
				? 0
				: roundPercent(
						(existing.outstandingPrincipal / args.totalOutstandingPrincipal) *
							100
					);
		return;
	}

	rows.push({
		count: 1,
		key: args.key,
		label: args.label,
		outstandingPrincipal: args.outstandingPrincipal,
		sharePercent:
			args.totalOutstandingPrincipal === 0
				? 0
				: roundPercent(
						(args.outstandingPrincipal / args.totalOutstandingPrincipal) * 100
					),
	});
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
	return args.obligation.status;
}

async function loadMicPortalLenderOrThrow(
	ctx: MicPortfolioCtx,
	portalId: Id<"portals">
) {
	const config = await resolveMicPortalConfig(ctx, portalId);
	if (config.availability !== "active") {
		throw new ConvexError(`Forbidden: MIC portal ${config.availability}`);
	}

	const lender = await getLenderByAuthId(ctx, config.micLenderAuthId);
	if (!lender) {
		throw new ConvexError("Forbidden: MIC lender mapping cannot be resolved");
	}

	return { lender, micLenderAuthId: config.micLenderAuthId };
}

async function listMicPositionAccounts(
	ctx: MicPortfolioCtx,
	micLenderAuthId: string
): Promise<MicPositionAccount[]> {
	const accounts = await ctx.db
		.query("ledger_accounts")
		.withIndex("by_lender", (query) => query.eq("lenderId", micLenderAuthId))
		.collect();

	return accounts
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
				"MIC position balance"
			),
			mortgageId: account.mortgageId as Id<"mortgages">,
		}));
}

async function loadListingByMortgageMap(
	ctx: MicPortfolioCtx,
	mortgageIds: readonly Id<"mortgages">[]
) {
	const entries = await Promise.all(
		mortgageIds.map(async (mortgageId) => {
			const listing = await ctx.db
				.query("listings")
				.withIndex("by_mortgage", (query) => query.eq("mortgageId", mortgageId))
				.first();
			return [String(mortgageId), listing] as const;
		})
	);
	return new Map(entries);
}

async function loadBorrowerLabelByMortgageMap(
	ctx: MicPortfolioCtx,
	mortgageIds: readonly Id<"mortgages">[]
) {
	const entries = await Promise.all(
		mortgageIds.map(async (mortgageId) => {
			const mortgageBorrower = await ctx.db
				.query("mortgageBorrowers")
				.withIndex("by_mortgage", (query) => query.eq("mortgageId", mortgageId))
				.first();
			if (!mortgageBorrower) {
				return [String(mortgageId), "Unknown borrower"] as const;
			}
			const borrower = await ctx.db.get(mortgageBorrower.borrowerId);
			const user = borrower ? await ctx.db.get(borrower.userId) : null;
			const label = user
				? [user.firstName, user.lastName].filter(Boolean).join(" ")
				: "Unknown borrower";
			return [String(mortgageId), label || "Unknown borrower"] as const;
		})
	);
	return new Map(entries);
}

async function loadPaymentsForMortgage(
	ctx: MicPortfolioCtx,
	args: {
		balanceUnits: number;
		mortgage: Doc<"mortgages">;
		propertyLabel: string;
	}
): Promise<MicPaymentHistoryRow[]> {
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

	const latestTransferByObligationId = new Map<
		string,
		Doc<"transferRequests"> | null
	>();
	await Promise.all(
		obligations.map(async (obligation) => {
			const transfers = await ctx.db
				.query("transferRequests")
				.withIndex("by_obligation", (query) =>
					query.eq("obligationId", obligation._id)
				)
				.collect();
			const latestTransfer =
				[...transfers].sort(
					(left, right) => right.createdAt - left.createdAt
				)[0] ?? null;
			latestTransferByObligationId.set(String(obligation._id), latestTransfer);
		})
	);

	return obligations
		.sort((left, right) => right.dueDate - left.dueDate)
		.map((obligation) => {
			const latestAttempt =
				latestAttemptByObligationId.get(String(obligation._id)) ?? null;
			const latestTransfer =
				latestTransferByObligationId.get(String(obligation._id)) ?? null;
			const grossAmount = centsToDollars(obligation.amount);
			const micShareAmount = calculateMicShareAmount(
				args.balanceUnits,
				grossAmount
			);
			const micSharePercentOfGross =
				grossAmount === 0
					? null
					: roundPercent((micShareAmount / grossAmount) * 100);
			return {
				amountSettled: centsToDollars(obligation.amountSettled),
				dueDate: unixMsToBusinessDate(obligation.dueDate),
				grossAmount,
				latestCollectionStatus: latestAttempt?.status ?? null,
				latestTransferStatus: latestTransfer?.status ?? null,
				micShareAmount,
				micSharePercentOfGross,
				mortgageId: String(args.mortgage._id),
				obligationId: String(obligation._id),
				paymentNumber: obligation.paymentNumber,
				propertyLabel: args.propertyLabel,
				rowStatus: buildRowStatus({
					latestAttempt,
					latestTransfer,
					obligation,
				}),
				type: obligation.type,
			};
		});
}

function summarizeArrears(payments: readonly MicPaymentHistoryRow[]) {
	const exceptionRows = payments.filter(
		(payment) =>
			payment.rowStatus === "exception" ||
			payment.latestCollectionStatus === "failed" ||
			payment.latestTransferStatus === "failed"
	);
	const overdueRows = payments.filter((payment) =>
		["overdue", "exception"].includes(payment.rowStatus)
	);
	if (exceptionRows.length > 0) {
		return {
			overdueAmount: roundCurrency(
				overdueRows.reduce((sum, row) => sum + row.micShareAmount, 0)
			),
			overdueCount: overdueRows.length,
			status: "exception" as const,
		};
	}
	if (overdueRows.length > 0) {
		return {
			overdueAmount: roundCurrency(
				overdueRows.reduce((sum, row) => sum + row.micShareAmount, 0)
			),
			overdueCount: overdueRows.length,
			status: "overdue" as const,
		};
	}
	const dueRows = payments.filter((payment) => payment.rowStatus === "due");
	if (dueRows.length > 0) {
		return {
			overdueAmount: 0,
			overdueCount: 0,
			status: "due" as const,
		};
	}
	return {
		overdueAmount: 0,
		overdueCount: 0,
		status: "current" as const,
	};
}

function resolveCurrentPayment(
	payments: readonly MicPaymentHistoryRow[]
): MicPositionCurrentPayment | null {
	const openPayment = [...payments]
		.filter((payment) => payment.rowStatus !== "settled")
		.sort((left, right) => left.dueDate.localeCompare(right.dueDate))[0];
	const fallbackPayment = payments[0];
	const payment = openPayment ?? fallbackPayment;
	if (!payment) {
		return null;
	}

	return {
		amount: payment.micShareAmount,
		dueDate: payment.dueDate,
		status: payment.rowStatus,
	};
}

function matchesFilters(row: MicPositionRow, filters: MicPositionFilters) {
	if (filters.status && row.status !== filters.status) {
		return false;
	}
	if (
		filters.propertyType &&
		row.propertySummary.propertyType !== filters.propertyType
	) {
		return false;
	}
	if (filters.province && row.propertySummary.province !== filters.province) {
		return false;
	}
	if (filters.searchQuery) {
		const normalizedQuery = filters.searchQuery.trim().toLowerCase();
		const haystack = [
			row.borrowerLabel,
			row.mortgageId,
			row.propertyLabel,
			row.status,
		]
			.join(" ")
			.toLowerCase();
		return haystack.includes(normalizedQuery);
	}
	return true;
}

function buildConcentration(
	positions: readonly MicPositionProjection[],
	totalOutstandingPrincipal: number
): MicConcentrationExposureData {
	const concentration = emptyConcentration();
	for (const position of positions) {
		const outstandingPrincipal = position.row.outstandingPrincipal;
		addConcentration(concentration.byBorrower, {
			key: position.row.borrowerLabel,
			label: position.row.borrowerLabel,
			outstandingPrincipal,
			totalOutstandingPrincipal,
		});
		addConcentration(concentration.byGeography, {
			key: position.row.propertySummary.province,
			label: position.row.propertySummary.province,
			outstandingPrincipal,
			totalOutstandingPrincipal,
		});
		addConcentration(concentration.byPropertyType, {
			key: position.row.propertySummary.propertyType,
			label: position.row.propertySummary.propertyType,
			outstandingPrincipal,
			totalOutstandingPrincipal,
		});
		addConcentration(concentration.byStatus, {
			key: position.row.status,
			label: position.row.status,
			outstandingPrincipal,
			totalOutstandingPrincipal,
		});
	}
	return concentration;
}

function buildMaturityLadder(
	positions: readonly MicPositionProjection[],
	generatedAt: number
) {
	const rows: MicMaturityLadderBucket[] = [];
	for (const position of positions) {
		const bucket = maturityBucket(position.mortgage.maturityDate, generatedAt);
		const existing = rows.find((row) => row.bucket === bucket);
		if (existing) {
			existing.count += 1;
			existing.outstandingPrincipal = roundCurrency(
				existing.outstandingPrincipal + position.row.outstandingPrincipal
			);
			continue;
		}
		rows.push({
			bucket,
			count: 1,
			outstandingPrincipal: position.row.outstandingPrincipal,
		});
	}
	return rows;
}

function emptyReturnBucket(period: string) {
	return {
		feeIncome: 0,
		interestIncome: 0,
		originatedPrincipal: 0,
		period,
	};
}

function isInterestIncomePayment(payment: MicPaymentHistoryRow) {
	return payment.type.toLowerCase().includes("interest");
}

function calculateExpectedMicInterest(payment: MicPaymentHistoryRow) {
	if (!isInterestIncomePayment(payment)) {
		return 0;
	}
	if (payment.grossAmount <= 0) {
		return 0;
	}
	return payment.micShareAmount;
}

function buildReturnSeries(
	positions: readonly MicPositionProjection[]
): MicReturnSeriesRow[] {
	const buckets = new Map<string, ReturnType<typeof emptyReturnBucket>>();

	function bucketFor(period: string) {
		const existing = buckets.get(period);
		if (existing) {
			return existing;
		}
		const next = emptyReturnBucket(period);
		buckets.set(period, next);
		return next;
	}

	for (const position of positions) {
		const originatedPrincipal = centsToDollars(position.mortgage.principal);
		const feeIncome = roundCurrency(
			(originatedPrincipal * INFERRED_LENDING_FEE_BASIS_POINTS) / 10_000
		);
		const originatedPeriod = monthPeriodFromBusinessDate(
			position.mortgage.termStartDate
		);
		const originationBucket = bucketFor(originatedPeriod);
		originationBucket.originatedPrincipal = roundCurrency(
			originationBucket.originatedPrincipal + originatedPrincipal
		);
		originationBucket.feeIncome = roundCurrency(
			originationBucket.feeIncome + feeIncome
		);

		for (const payment of position.payments) {
			const expectedInterest = calculateExpectedMicInterest(payment);
			if (expectedInterest <= 0) {
				continue;
			}
			const interestPeriod = previousMonthPeriodFromBusinessDate(
				payment.dueDate
			);
			const paymentBucket = bucketFor(interestPeriod);
			paymentBucket.interestIncome = roundCurrency(
				paymentBucket.interestIncome + expectedInterest
			);
		}
	}

	let cumulativeFeeIncome = 0;
	let cumulativeInterestIncome = 0;

	return [...buckets.values()]
		.sort((left, right) => left.period.localeCompare(right.period))
		.map((bucket) => {
			const feeIncome = roundCurrency(bucket.feeIncome);
			const interestIncome = roundCurrency(bucket.interestIncome);
			const totalReturn = roundCurrency(feeIncome + interestIncome);
			cumulativeFeeIncome = roundCurrency(cumulativeFeeIncome + feeIncome);
			cumulativeInterestIncome = roundCurrency(
				cumulativeInterestIncome + interestIncome
			);
			const cumulativeTotalReturn = roundCurrency(
				cumulativeFeeIncome + cumulativeInterestIncome
			);
			return {
				cumulativeFeeIncome,
				cumulativeInterestIncome,
				cumulativeTotalReturn,
				feeIncome,
				feeIncomeSharePercent: calculateSharePercent(
					cumulativeFeeIncome,
					cumulativeTotalReturn
				),
				interestIncome,
				originatedPrincipal: roundCurrency(bucket.originatedPrincipal),
				period: bucket.period,
				totalReturn,
			};
		});
}

function buildLendingFeeMetrics(
	returnSeries: readonly MicReturnSeriesRow[],
	mortgageOriginatedCount: number
): MicLendingFeeMetrics {
	const originatedPrincipal = roundCurrency(
		returnSeries.reduce((sum, row) => sum + row.originatedPrincipal, 0)
	);
	const inferredLendingFeeIncome = roundCurrency(
		returnSeries.reduce((sum, row) => sum + row.feeIncome, 0)
	);
	const totalInterestIncome = roundCurrency(
		returnSeries.reduce((sum, row) => sum + row.interestIncome, 0)
	);
	const totalReturnIncome = roundCurrency(
		inferredLendingFeeIncome + totalInterestIncome
	);
	return {
		feeBasisPoints: INFERRED_LENDING_FEE_BASIS_POINTS,
		inferredLendingFeeIncome,
		lendingFeeIncomeSharePercent: calculateSharePercent(
			inferredLendingFeeIncome,
			totalReturnIncome
		),
		mortgageOriginatedCount,
		originatedPrincipal,
		totalInterestIncome,
		totalReturnIncome,
	};
}

function buildMetrics(
	positions: readonly MicPositionProjection[],
	lendingFeeMetrics: MicLendingFeeMetrics
): MicPortfolioMetrics {
	const outstandingPrincipal = roundCurrency(
		positions.reduce(
			(sum, position) => sum + position.row.outstandingPrincipal,
			0
		)
	);
	const weightedAverageYield =
		outstandingPrincipal === 0
			? null
			: roundPercent(
					positions.reduce(
						(sum, position) =>
							sum +
							(position.row.rateYield ?? 0) * position.row.outstandingPrincipal,
						0
					) / outstandingPrincipal
				);
	const weightedAverageLtv =
		outstandingPrincipal === 0
			? null
			: roundPercent(
					positions.reduce(
						(sum, position) =>
							sum + (position.row.ltv ?? 0) * position.row.outstandingPrincipal,
						0
					) / outstandingPrincipal
				);

	return {
		activePositionCount: positions.length,
		arrearsExposure: roundCurrency(
			positions
				.filter((position) =>
					["overdue", "exception"].includes(position.row.arrearsSignal.status)
				)
				.reduce((sum, position) => sum + position.row.outstandingPrincipal, 0)
		),
		delinquencyExposure: roundCurrency(
			positions
				.filter((position) => position.row.arrearsSignal.status === "exception")
				.reduce((sum, position) => sum + position.row.outstandingPrincipal, 0)
		),
		inferredLendingFeeIncome: lendingFeeMetrics.inferredLendingFeeIncome,
		lendingFeeIncomeSharePercent:
			lendingFeeMetrics.lendingFeeIncomeSharePercent,
		outstandingPrincipal,
		totalReturnIncome: lendingFeeMetrics.totalReturnIncome,
		weightedAverageLtv,
		weightedAverageYield,
	};
}

async function buildMicPortfolioProjection(
	ctx: MicPortfolioCtx,
	portalId: Id<"portals">
): Promise<MicPortfolioProjection> {
	const generatedAt = Date.now();
	const { micLenderAuthId } = await loadMicPortalLenderOrThrow(ctx, portalId);
	const positions = await listMicPositionAccounts(ctx, micLenderAuthId);
	const mortgageIds = positions.map((position) => position.mortgageId);
	const [listingByMortgage, borrowerLabelByMortgage] = await Promise.all([
		loadListingByMortgageMap(ctx, mortgageIds),
		loadBorrowerLabelByMortgageMap(ctx, mortgageIds),
	]);

	const projectedPositions = (
		await Promise.all(
			positions.map(async (position) => {
				const mortgage = await ctx.db.get(position.mortgageId);
				if (!mortgage) {
					throw new ConvexError("MIC position mortgage is missing");
				}
				const property = await ctx.db.get(mortgage.propertyId);
				if (!property) {
					throw new ConvexError("MIC position property is missing");
				}
				const propertyLabel = buildPropertyLabel(property);
				const payments = await loadPaymentsForMortgage(ctx, {
					balanceUnits: position.balanceUnits,
					mortgage,
					propertyLabel,
				});
				const arrearsSignal = summarizeArrears(payments);
				const listing = listingByMortgage.get(String(mortgage._id)) ?? null;
				const thumbnailUrl = listing
					? await getHeroImageUrl(ctx, listing.heroImages[0])
					: null;
				const outstandingPrincipal = calculateMicShareAmount(
					position.balanceUnits,
					centsToDollars(mortgage.principal)
				);
				const borrowerLabel =
					borrowerLabelByMortgage.get(String(mortgage._id)) ??
					"Unknown borrower";
				const row: MicPositionRow = {
					arrearsSignal,
					borrowerLabel,
					drilldownIds: {
						listingId: listing ? String(listing._id) : null,
						mortgageId: String(mortgage._id),
						positionAccountId: String(position.accountId),
						propertyId: String(property._id),
					},
					ltv: listing?.ltvRatio ?? null,
					maturityDate: mortgage.maturityDate,
					mortgageId: String(mortgage._id),
					outstandingPrincipal,
					positionAccountId: String(position.accountId),
					positionUnits: position.balanceUnits,
					principal: centsToDollars(mortgage.principal),
					propertyLabel,
					propertySummary: {
						city: property.city,
						propertyType: property.propertyType,
						province: property.province,
						streetAddress: property.streetAddress,
						unit: toNullableString(property.unit),
					},
					rateYield: mortgage.interestRate,
					status: mortgage.status,
					currentPayment: resolveCurrentPayment(payments),
					thumbnailUrl,
				};
				return { listing, mortgage, payments, position, property, row };
			})
		)
	).sort((left, right) =>
		left.row.propertyLabel.localeCompare(right.row.propertyLabel)
	);

	const returnSeries = buildReturnSeries(projectedPositions);
	const lendingFeeMetrics = buildLendingFeeMetrics(
		returnSeries,
		projectedPositions.length
	);
	const metrics = buildMetrics(projectedPositions, lendingFeeMetrics);
	return {
		concentration: buildConcentration(
			projectedPositions,
			metrics.outstandingPrincipal
		),
		dataCompleteness: "partial",
		generatedAt,
		lendingFeeMetrics,
		maturityLadder: buildMaturityLadder(projectedPositions, generatedAt),
		metrics,
		positions: projectedPositions,
		returnSeries,
		warnings: [CASH_LEDGER_WARNING],
	};
}

function buildEnvelope(projection: MicPortfolioProjection) {
	return {
		dataCompleteness: projection.dataCompleteness,
		generatedAt: projection.generatedAt,
		sourceOfTruth: MIC_SOURCE_OF_TRUTH,
		warnings: projection.warnings,
	};
}

function buildMicOwnership(balanceUnits: number) {
	const totalUnits = Number(TOTAL_SUPPLY);
	return {
		percent: roundPercent((balanceUnits / totalUnits) * 100),
		totalUnits,
		units: balanceUnits,
	};
}

function dealFractionalSharePercent(units: number) {
	return roundPercent((units / Number(TOTAL_SUPPLY)) * 100);
}

async function buildPositionDetail(
	ctx: MicPortfolioCtx,
	position: MicPositionProjection
): Promise<MicPositionDetailData> {
	const listing = position.listing;
	const heroImages: MicListingHeroImage[] = listing
		? await Promise.all(
				listing.heroImages.map(async (image, index) => ({
					caption: image.caption ?? null,
					id: `${String(listing._id)}:${String(index)}`,
					url: await getHeroImageUrl(ctx, image),
				}))
			)
		: [];

	const [deals, transfers, auditEntries] = await Promise.all([
		ctx.db
			.query("deals")
			.withIndex("by_mortgage", (q) =>
				q.eq("mortgageId", position.mortgage._id)
			)
			.collect(),
		ctx.db
			.query("transferRequests")
			.withIndex("by_mortgage", (q) =>
				q.eq("mortgageId", position.mortgage._id)
			)
			.collect(),
		ctx.db
			.query("auditJournal")
			.withIndex("by_mortgage", (q) =>
				q.eq("mortgageId", String(position.mortgage._id))
			)
			.collect(),
	]);

	const dealHistory: MicDealHistoryRow[] = [...deals]
		.sort((left, right) => right.createdAt - left.createdAt)
		.slice(0, MIC_DEAL_HISTORY_CAP)
		.map((deal) => {
			const isTerminal = DEAL_TERMINAL_STATUSES.has(deal.status);
			return {
				closingDate: deal.closingDate ?? null,
				createdAt: deal.createdAt,
				dealId: String(deal._id),
				fractionalSharePercent: dealFractionalSharePercent(
					deal.fractionalShare
				),
				fractionalShareUnits: deal.fractionalShare,
				isTerminal,
				status: deal.status,
			};
		});

	const ongoingDeals = dealHistory
		.filter((row) => !row.isTerminal)
		.slice(0, MIC_ONGOING_DEALS_CAP);

	const transferHistory: MicTransferHistoryRow[] = [...transfers]
		.sort((left, right) => right.createdAt - left.createdAt)
		.slice(0, MIC_TRANSFER_HISTORY_CAP)
		.map((transfer) => ({
			amount: centsToDollars(transfer.amount),
			createdAt: transfer.createdAt,
			currency: transfer.currency,
			direction: transfer.direction,
			hasObligationLink: transfer.obligationId !== undefined,
			status: transfer.status,
			transferId: String(transfer._id),
			transferType: transfer.transferType,
		}));

	const auditHistory: MicAuditHistoryRow[] = [...auditEntries]
		.sort((left, right) => right.timestamp - left.timestamp)
		.slice(0, MIC_AUDIT_HISTORY_CAP)
		.map((entry) => ({
			entityType: entry.entityType,
			eventId: entry.eventId,
			eventType: entry.eventType,
			newState: entry.newState,
			outcome: entry.outcome,
			previousState: entry.previousState,
			reason: entry.reason ?? null,
			sequenceNumber: String(entry.sequenceNumber),
			timestamp: entry.timestamp,
		}));

	return {
		auditHistory,
		dealHistory,
		heroImages,
		micOwnership: buildMicOwnership(position.position.balanceUnits),
		mortgage: {
			amortizationMonths: position.mortgage.amortizationMonths,
			firstPaymentDate: position.mortgage.firstPaymentDate,
			interestRate: position.mortgage.interestRate,
			lienPosition: position.mortgage.lienPosition,
			loanType: position.mortgage.loanType,
			maturityDate: position.mortgage.maturityDate,
			mortgageId: String(position.mortgage._id),
			paymentAmount: centsToDollars(position.mortgage.paymentAmount),
			paymentFrequency: position.mortgage.paymentFrequency,
			principal: centsToDollars(position.mortgage.principal),
			rateType: position.mortgage.rateType,
			status: position.mortgage.status,
			termMonths: position.mortgage.termMonths,
			termStartDate: position.mortgage.termStartDate,
		},
		ongoingDeals,
		payments: position.payments,
		position: position.row,
		property: {
			city: position.property.city,
			postalCode: position.property.postalCode,
			propertyId: String(position.property._id),
			propertyType: position.property.propertyType,
			province: position.property.province,
			streetAddress: position.property.streetAddress,
			unit: toNullableString(position.property.unit),
		},
		transferHistory,
	};
}

export const getMicDashboardSnapshot = authedQuery
	.input({ portalId: v.id("portals") })
	.use(requirePermission("mic:access"))
	.returns(micDashboardSnapshotValidator)
	.handler(async (ctx, args): Promise<MicDashboardSnapshot> => {
		const projection = await buildMicPortfolioProjection(ctx, args.portalId);
		return {
			...buildEnvelope(projection),
			concentration: projection.concentration,
			lendingFeeMetrics: projection.lendingFeeMetrics,
			maturityLadder: projection.maturityLadder,
			metrics: projection.metrics,
			positions: projection.positions.map((position) => position.row),
			returnSeries: projection.returnSeries,
		};
	})
	.public();

export const getMicPositions = authedQuery
	.input({
		filters: v.optional(micPositionFiltersValidator),
		portalId: v.id("portals"),
	})
	.use(requirePermission("mic:access"))
	.returns(micPositionsResultValidator)
	.handler(async (ctx, args) => {
		const projection = await buildMicPortfolioProjection(ctx, args.portalId);
		const rows = projection.positions
			.map((position) => position.row)
			.filter((row) => !args.filters || matchesFilters(row, args.filters));
		return {
			...buildEnvelope(projection),
			filters: args.filters ?? null,
			rows,
		};
	})
	.public();

export const getMicPositionDetail = authedQuery
	.input({
		mortgageId: v.id("mortgages"),
		portalId: v.id("portals"),
	})
	.use(requirePermission("mic:access"))
	.returns(micPositionDetailResultValidator)
	.handler(async (ctx, args) => {
		const projection = await buildMicPortfolioProjection(ctx, args.portalId);
		const position =
			projection.positions.find(
				(entry) => String(entry.mortgage._id) === String(args.mortgageId)
			) ?? null;
		if (!position) {
			throw new ConvexError("MIC position not found");
		}
		return {
			...buildEnvelope(projection),
			position: await buildPositionDetail(ctx, position),
		};
	})
	.public();

export const getMicPaymentsHistory = authedQuery
	.input({
		mortgageId: v.optional(v.id("mortgages")),
		portalId: v.id("portals"),
	})
	.use(requirePermission("mic:access"))
	.returns(micPaymentsHistoryResultValidator)
	.handler(async (ctx, args) => {
		const projection = await buildMicPortfolioProjection(ctx, args.portalId);
		const scopedPositions = args.mortgageId
			? projection.positions.filter(
					(position) =>
						String(position.mortgage._id) === String(args.mortgageId)
				)
			: projection.positions;
		if (args.mortgageId && scopedPositions.length === 0) {
			throw new ConvexError("MIC position not found");
		}
		return {
			...buildEnvelope(projection),
			mortgageId: args.mortgageId ? String(args.mortgageId) : null,
			rows: scopedPositions
				.flatMap((position) => position.payments)
				.sort((left, right) => right.dueDate.localeCompare(left.dueDate)),
		};
	})
	.public();

export const getMicConcentrationExposure = authedQuery
	.input({ portalId: v.id("portals") })
	.use(requirePermission("mic:access"))
	.returns(micConcentrationExposureResultValidator)
	.handler(async (ctx, args) => {
		const projection = await buildMicPortfolioProjection(ctx, args.portalId);
		return {
			...buildEnvelope(projection),
			concentration: projection.concentration,
		};
	})
	.public();
