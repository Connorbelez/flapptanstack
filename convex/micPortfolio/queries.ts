import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { getLenderByAuthId } from "../auth/actorResolution";
import { authedQuery, requirePermission } from "../fluent";
import { getPostedBalance } from "../ledger/accounts";
import { TOTAL_SUPPLY } from "../ledger/constants";
import { unixMsToBusinessDate } from "../lib/businessDates";
import { resolveMicPortalConfig } from "../portals/micConfig";
import {
	type MicConcentrationExposureData,
	type MicDashboardSnapshot,
	type MicMaturityLadderBucket,
	type MicPaymentHistoryRow,
	type MicPortfolioDataCompleteness,
	type MicPortfolioMetrics,
	type MicPortfolioSourceOfTruth,
	type MicPositionDetailData,
	type MicPositionFilters,
	type MicPositionRow,
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

interface MicPositionAccount {
	accountId: Id<"ledger_accounts">;
	balanceUnits: number;
	mortgageId: Id<"mortgages">;
}

interface MicPositionProjection {
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
	maturityLadder: MicMaturityLadderBucket[];
	metrics: MicPortfolioMetrics;
	positions: MicPositionProjection[];
	warnings: string[];
}

type MicPortfolioCtx = Pick<QueryCtx, "db">;

function centsToDollars(value: number) {
	return roundCurrency(value / 100);
}

function roundCurrency(value: number) {
	return Math.round(value * 100) / 100;
}

function roundPercent(value: number) {
	return Math.round(value * 100) / 100;
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
			return {
				amountSettled: centsToDollars(obligation.amountSettled),
				dueDate: unixMsToBusinessDate(obligation.dueDate),
				grossAmount,
				latestCollectionStatus: latestAttempt?.status ?? null,
				latestTransferStatus: latestTransfer?.status ?? null,
				micShareAmount: calculateMicShareAmount(args.balanceUnits, grossAmount),
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

function buildMetrics(
	positions: readonly MicPositionProjection[]
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
		outstandingPrincipal,
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
				const outstandingPrincipal = calculateMicShareAmount(
					position.balanceUnits,
					mortgage.principal
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
					principal: mortgage.principal,
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
				};
				return { mortgage, payments, position, property, row };
			})
		)
	).sort((left, right) =>
		left.row.propertyLabel.localeCompare(right.row.propertyLabel)
	);

	const metrics = buildMetrics(projectedPositions);
	return {
		concentration: buildConcentration(
			projectedPositions,
			metrics.outstandingPrincipal
		),
		dataCompleteness: "partial",
		generatedAt,
		maturityLadder: buildMaturityLadder(projectedPositions, generatedAt),
		metrics,
		positions: projectedPositions,
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

function buildPositionDetail(
	position: MicPositionProjection
): MicPositionDetailData {
	return {
		mortgage: {
			amortizationMonths: position.mortgage.amortizationMonths,
			firstPaymentDate: position.mortgage.firstPaymentDate,
			interestRate: position.mortgage.interestRate,
			lienPosition: position.mortgage.lienPosition,
			loanType: position.mortgage.loanType,
			maturityDate: position.mortgage.maturityDate,
			mortgageId: String(position.mortgage._id),
			paymentAmount: position.mortgage.paymentAmount,
			paymentFrequency: position.mortgage.paymentFrequency,
			principal: position.mortgage.principal,
			rateType: position.mortgage.rateType,
			status: position.mortgage.status,
			termMonths: position.mortgage.termMonths,
			termStartDate: position.mortgage.termStartDate,
		},
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
			maturityLadder: projection.maturityLadder,
			metrics: projection.metrics,
			positions: projection.positions.map((position) => position.row),
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
			position: buildPositionDetail(position),
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
