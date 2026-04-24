import type { FunctionReturnType } from "convex/server";
import {
	formatPortfolioCompactCurrency,
	formatPortfolioCurrency,
	formatPortfolioDate,
	formatPortfolioEnumLabel,
	formatPortfolioPercent,
	formatPortfolioRate,
} from "#/components/lender/portfolio/portfolio-formatters";
import type { api } from "../../../../convex/_generated/api";
import type {
	MicActivityItem,
	MicExposureCard,
	MicFocusItem,
	MicMetricCard,
	MicMortgageDetail,
	MicPortfolioSnapshot,
	MicPositionRow,
	MicTimelineEvent,
} from "./types";

type MicPortfolioCommandCenter = FunctionReturnType<
	typeof api.micPortfolio.queries.getMicPortfolioCommandCenter
>;
type MicPortfolioPositionDetail = FunctionReturnType<
	typeof api.micPortfolio.queries.getMicPortfolioPositionDetail
>;
type MicPortfolioMortgageDetailPage = FunctionReturnType<
	typeof api.micPortfolio.queries.getMicPortfolioMortgageDetailPage
>;

function formatDateLabelFromTimestamp(timestamp: number) {
	return `As of ${new Date(timestamp).toLocaleDateString("en-CA", {
		day: "numeric",
		month: "short",
		year: "numeric",
	})}`;
}

function buildMetricCards(
	data: MicPortfolioCommandCenter["cockpit"]["metrics"]
): MicMetricCard[] {
	return [
		{
			description:
				"Estimated value of the MIC's live mortgage participation based on current ledger positions.",
			label: "Estimated portfolio value",
			value: formatPortfolioCompactCurrency(data.estimatedPortfolioValue),
		},
		{
			description:
				"Weighted average note rate across the active mortgages reflected in this MIC view.",
			label: "Weighted average yield",
			tone: "positive",
			value: formatPortfolioRate(data.weightedAverageInterestRate),
		},
		{
			description:
				"Mortgage positions presently attributed to the MIC lender in the mortgage ledger.",
			label: "Active positions",
			value: String(data.activePositionCount),
		},
		{
			description:
				"Combined renewal and payment watchpoints currently visible in the operational book.",
			label: "Watchpoints",
			tone:
				data.paymentExceptionCount + data.renewalsDueSoonCount > 0
					? "critical"
					: "default",
			value: String(data.paymentExceptionCount + data.renewalsDueSoonCount),
		},
	];
}

function buildFocusItems(data: MicPortfolioCommandCenter): MicFocusItem[] {
	const items = data.actionsRequired.items.slice(0, 3).map((item) => ({
		id: item.id,
		label: formatPortfolioEnumLabel(item.kind),
		severity:
			item.priority === "high"
				? ("critical" as const)
				: item.priority === "medium"
					? ("warning" as const)
					: ("info" as const),
		summary: item.summary,
		title: item.title,
		value: item.dueDate
			? `Due ${formatPortfolioDate(item.dueDate)}`
			: undefined,
	}));

	if (items.length > 0) {
		return items;
	}

	return [
		{
			id: "focus-ledger-boundary",
			label: "Transparency note",
			severity: "info",
			summary:
				"Treasury and cash-on-hand are intentionally excluded until cash-ledger coverage exists for the MIC treasury.",
			title: "Current system truth only",
		},
	];
}

function buildExposureCards(
	data: MicPortfolioCommandCenter
): MicExposureCard[] {
	const topStatus = [...data.cockpit.breakdowns.byMortgageStatus].sort(
		(left, right) => right.positionUnits - left.positionUnits
	)[0];
	const topPropertyType = [...data.cockpit.breakdowns.byPropertyType].sort(
		(left, right) => right.positionUnits - left.positionUnits
	)[0];

	return [
		{
			description:
				"Largest mortgage-status concentration currently visible in the MIC position book.",
			label: "Top status concentration",
			value: topStatus
				? `${formatPortfolioEnumLabel(topStatus.key)} (${topStatus.count})`
				: "Unavailable",
		},
		{
			description:
				"Dominant property type represented across the current MIC mortgage participation.",
			label: "Largest property mix",
			value: topPropertyType
				? `${formatPortfolioEnumLabel(topPropertyType.key)} (${topPropertyType.count})`
				: "Unavailable",
		},
		{
			description:
				"Undisbursed lender-side balance already available from the system, distinct from treasury cash reporting.",
			label: "Undisbursed balance",
			value: formatPortfolioCompactCurrency(
				data.cockpit.metrics.undisbursedBalance
			),
		},
	];
}

function buildRecentActivity(
	data: MicPortfolioCommandCenter
): MicActivityItem[] {
	return data.actionsRequired.items.slice(0, 3).map((item) => ({
		dateLabel: item.dueDate ? formatPortfolioDate(item.dueDate) : "Current",
		id: item.id,
		summary: item.summary,
		title: item.title,
	}));
}

function buildPositionRows(
	rows: MicPortfolioCommandCenter["positions"]["rows"]
): MicPositionRow[] {
	return rows.map((row) => ({
		borrowerLabel: row.borrowerLabel ?? "Borrower unavailable",
		city: row.city ?? "Unavailable",
		currentLtvPercent: row.currentLtvPercent,
		currentPrincipal: row.currentPrincipal,
		maturityDate: row.maturityDate,
		mortgageId: row.mortgageId,
		mortgageStatus: row.mortgageStatus,
		nextPaymentDate: row.nextPaymentDate,
		paymentAmount: row.paymentAmount,
		positionPercent: row.positionPercent,
		propertyLabel: row.propertyLabel,
		propertyType: row.propertyType ?? "Unavailable",
		province: row.province ?? "Unavailable",
		thumbnailUrl: row.thumbnailUrl,
		weightedRatePercent: row.weightedRatePercent,
	}));
}

function buildDisclosures(extra: string[] = []) {
	return [
		"Displayed values are limited to mortgage-ledger and mortgage-fact data presently modeled in FairLend.",
		"MIC cash, reserve, and treasury reporting are intentionally omitted until cash-ledger coverage exists.",
		...extra,
	];
}

function buildBaseDetail(
	detail: MicPortfolioPositionDetail
): Omit<MicMortgageDetail, "disclosures" | "history"> {
	return {
		addressLine: [
			detail.property.unit,
			detail.property.streetAddress,
			detail.property.city,
			detail.property.province,
		]
			.filter(Boolean)
			.join(", "),
		economicsFields: [
			{
				label: "Current principal",
				value: formatPortfolioCurrency(detail.mortgage.principal),
			},
			{
				label: "Coupon",
				value: formatPortfolioRate(detail.mortgage.interestRate),
			},
			{
				label: "Payment amount",
				value: formatPortfolioCurrency(detail.mortgage.paymentAmount),
			},
			{
				label: "Payment frequency",
				value: formatPortfolioEnumLabel(detail.mortgage.paymentFrequency),
			},
			{
				label: "Maturity date",
				value: formatPortfolioDate(detail.mortgage.maturityDate),
			},
		],
		heroImageUrl: detail.property.heroImageUrl,
		mortgageId: detail.mortgage.mortgageId,
		overviewFields: [
			{ label: "Property", value: detail.position.propertyLabel },
			{
				label: "Mortgage status",
				value: formatPortfolioEnumLabel(detail.mortgage.status),
			},
			{ label: "Renewal timing", value: detail.position.renewalTimingLabel },
			{
				label: "Position held",
				value: formatPortfolioPercent(detail.position.positionPercent),
			},
			{ label: "Fractions", value: String(detail.position.fractionCount) },
			{
				label: "Next payment",
				value: formatPortfolioDate(detail.paymentOverview.nextPaymentDate),
			},
		],
		propertyFields: [
			{
				label: "Property type",
				value: formatPortfolioEnumLabel(detail.property.propertyType),
			},
			{ label: "City", value: detail.property.city },
			{ label: "Province", value: detail.property.province },
			{
				label: "Postal code",
				value: detail.property.postalCode || "Unavailable",
			},
		],
		propertyLabel: detail.position.propertyLabel,
		servicingFields: [
			{
				label: "Renewal status",
				value: formatPortfolioEnumLabel(detail.renewal.status),
			},
			{
				label: "Signal deadline",
				value: formatPortfolioDate(detail.renewal.signalDeadline),
			},
			{
				label: "Broker acknowledged",
				value:
					typeof detail.renewal.brokerAcknowledgedAt === "number"
						? new Date(detail.renewal.brokerAcknowledgedAt).toLocaleDateString(
								"en-CA",
								{ day: "numeric", month: "short", year: "numeric" }
							)
						: "Unavailable",
			},
		],
		status: detail.mortgage.status,
		subtitle:
			"Read-only transparency into the mortgage record, servicing posture, and available ledger-backed details.",
		summaryMetrics: [
			{
				description:
					"Latest outstanding amount reflected in the mortgage record.",
				label: "Principal",
				value: formatPortfolioCompactCurrency(detail.mortgage.principal),
			},
			{
				description: "Current estimated MIC position value.",
				label: "Position value",
				value: formatPortfolioCompactCurrency(
					detail.position.estimatedPositionValue
				),
			},
			{
				description: "Expected upcoming borrower payment date.",
				label: "Next payment",
				value: formatPortfolioDate(detail.paymentOverview.nextPaymentDate),
			},
			{
				description: "Current note coupon attributed to the mortgage.",
				label: "Coupon",
				tone: "positive",
				value: formatPortfolioRate(detail.mortgage.interestRate),
			},
		],
	};
}

function buildHistoryFromQuickActions(
	detail: MicPortfolioPositionDetail
): MicTimelineEvent[] {
	return detail.quickActions.map((action) => ({
		dateLabel: action.dueDate ? formatPortfolioDate(action.dueDate) : "Current",
		id: action.id,
		kind: action.kind,
		summary: action.summary,
		title: action.title,
	}));
}

export function toMicPortfolioSnapshot(
	data: MicPortfolioCommandCenter
): MicPortfolioSnapshot {
	return {
		asOfLabel: formatDateLabelFromTimestamp(data.generatedAt),
		exposureCards: buildExposureCards(data),
		focusItems: buildFocusItems(data),
		fundName: "FairLend MIC",
		metricCards: buildMetricCards(data.cockpit.metrics),
		positions: buildPositionRows(data.positions.rows),
		recentActivity: buildRecentActivity(data),
		sourceNote:
			"All figures on this page are derived from currently available mortgage-ledger data and adjacent mortgage facts already in the system.",
		subtitle:
			"Read-only transparency into live MIC mortgage positions, servicing signals, and mortgage-level history.",
	};
}

export function toMicMortgageDetail(
	detail: MicPortfolioPositionDetail
): MicMortgageDetail {
	return {
		...buildBaseDetail(detail),
		disclosures: buildDisclosures(),
		history: buildHistoryFromQuickActions(detail),
	};
}

export function toMicMortgageDetailPage(
	page: MicPortfolioMortgageDetailPage
): MicMortgageDetail {
	const paymentHistory = page.paymentHistory.map((payment) => ({
		dateLabel: formatPortfolioDate(payment.dueDate),
		id: payment.obligationId,
		kind: payment.rowStatus,
		summary: `${formatPortfolioEnumLabel(payment.type)} payment ${payment.paymentNumber} is ${formatPortfolioEnumLabel(payment.rowStatus)}.`,
		title: `${page.positionDetail.position.propertyLabel} payment ${payment.paymentNumber}`,
	}));

	return {
		...buildBaseDetail(page.positionDetail),
		disclosures: buildDisclosures([
			page.sourceOfTruth.cockpitMetrics,
			page.sourceOfTruth.paymentActivityRows,
		]),
		history: [
			...paymentHistory,
			...buildHistoryFromQuickActions(page.positionDetail),
		],
	};
}
