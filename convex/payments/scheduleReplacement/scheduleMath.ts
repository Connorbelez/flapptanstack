import type {
	PaymentScheduleReplacementFrequency,
	PaymentScheduleReplacementRail,
	PaymentScheduleReplacementSliderBounds,
	PaymentScheduleReplacementValidationIssue,
	ScheduleReplacementPreviewRow,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_BUSINESS_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

interface CadenceInput {
	deadlineDate: number;
	paymentFrequency: PaymentScheduleReplacementFrequency;
	startDate: number;
}

interface SliderBoundsInput extends CadenceInput {
	outstandingInterestAmount: number;
}

interface ReplacementPreviewInput extends SliderBoundsInput {
	firstPaymentNumber: number;
	interestPaymentAmount: number;
	principalPayoffAmount: number;
	replacementRail: PaymentScheduleReplacementRail;
}

interface ReplacementPreviewResult {
	finalPayoffDate: number;
	interestInstallmentCount: number;
	issues: PaymentScheduleReplacementValidationIssue[];
	rows: ScheduleReplacementPreviewRow[];
	sliderBounds: PaymentScheduleReplacementSliderBounds;
}

function parseIsoBusinessDate(isoDate: string) {
	const match = ISO_BUSINESS_DATE_PATTERN.exec(isoDate);
	if (!match) {
		throw new Error(`Invalid business date: ${isoDate}`);
	}

	return {
		year: Number(match[1]),
		month: Number(match[2]),
		day: Number(match[3]),
	};
}

function lastDayOfMonth(year: number, month: number) {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatCadAmount(amount: number) {
	return new Intl.NumberFormat("en-CA", {
		currency: "CAD",
		style: "currency",
	}).format(amount / 100);
}

function buildGeneratedPrincipalRow(args: {
	amount: number;
	paymentNumber: number;
	scheduledDate: number;
}): ScheduleReplacementPreviewRow {
	return {
		amount: args.amount,
		dueDate: args.scheduledDate,
		editableDate: false,
		executionMode: "app_owned",
		kind: "replacement_principal",
		obligationType: "principal_repayment",
		paymentNumber: args.paymentNumber,
		rowKey: `generated-principal-${args.paymentNumber}`,
		scheduledDate: args.scheduledDate,
		status: "generated",
	};
}

export function toUtcBusinessDate(isoDate: string) {
	const { year, month, day } = parseIsoBusinessDate(isoDate);
	return Date.UTC(year, month - 1, day);
}

export function toIsoBusinessDate(timestamp: number) {
	return new Date(timestamp).toISOString().slice(0, 10);
}

export function addCalendarMonths(isoDate: string, months: number) {
	const { year, month, day } = parseIsoBusinessDate(isoDate);
	const targetMonthIndex = month - 1 + months;
	const targetYear = year + Math.floor(targetMonthIndex / 12);
	const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
	const targetMonth = normalizedMonthIndex + 1;
	const targetDay = Math.min(day, lastDayOfMonth(targetYear, targetMonth));

	return [
		String(targetYear).padStart(4, "0"),
		String(targetMonth).padStart(2, "0"),
		String(targetDay).padStart(2, "0"),
	].join("-");
}

export function addFrequencyDate(
	timestamp: number,
	frequency: PaymentScheduleReplacementFrequency
) {
	if (frequency === "monthly") {
		return toUtcBusinessDate(
			addCalendarMonths(toIsoBusinessDate(timestamp), 1)
		);
	}

	const days = frequency === "weekly" ? 7 : 14;
	return timestamp + days * DAY_MS;
}

export function buildCadenceDates({
	startDate,
	deadlineDate,
	paymentFrequency,
}: CadenceInput) {
	if (startDate > deadlineDate) {
		return [];
	}

	if (paymentFrequency !== "monthly") {
		const cadenceDates: number[] = [];
		for (
			let candidate = startDate;
			candidate <= deadlineDate;
			candidate = addFrequencyDate(candidate, paymentFrequency)
		) {
			cadenceDates.push(candidate);
		}
		return cadenceDates;
	}

	const startIsoDate = toIsoBusinessDate(startDate);
	const cadenceDates: number[] = [];
	for (let monthOffset = 0; ; monthOffset += 1) {
		const candidate = toUtcBusinessDate(
			addCalendarMonths(startIsoDate, monthOffset)
		);
		if (candidate > deadlineDate) {
			return cadenceDates;
		}
		cadenceDates.push(candidate);
	}
}

export function calculateSliderBounds({
	startDate,
	deadlineDate,
	paymentFrequency,
	outstandingInterestAmount,
}: SliderBoundsInput): PaymentScheduleReplacementSliderBounds {
	const cadenceDates = buildCadenceDates({
		startDate,
		deadlineDate,
		paymentFrequency,
	});
	const maxInterestRows = Math.max(0, cadenceDates.length - 1);

	return {
		maxInterestRows,
		minInterestPaymentAmount:
			maxInterestRows > 0
				? Math.ceil(outstandingInterestAmount / maxInterestRows)
				: 0,
		maxInterestPaymentAmount: outstandingInterestAmount,
		step: outstandingInterestAmount >= 100_000 ? 1000 : 100,
	};
}

export function buildReplacementPreview(
	input: ReplacementPreviewInput
): ReplacementPreviewResult {
	const cadenceDates = buildCadenceDates(input);
	const sliderBounds = calculateSliderBounds(input);
	const emptyResult = (
		issues: PaymentScheduleReplacementValidationIssue[]
	): ReplacementPreviewResult => ({
		finalPayoffDate: 0,
		interestInstallmentCount: 0,
		issues,
		rows: [],
		sliderBounds,
	});

	if (input.outstandingInterestAmount === 0) {
		const finalPayoffDate = cadenceDates[0];
		if (finalPayoffDate === undefined) {
			return emptyResult([
				{
					code: "insufficient_cadence_slots",
					message:
						"Selected start date and frequency do not leave room for both interest collection and final principal payoff before the deadline.",
				},
			]);
		}

		return {
			finalPayoffDate,
			interestInstallmentCount: 0,
			issues: [],
			rows: [
				buildGeneratedPrincipalRow({
					amount: input.principalPayoffAmount,
					paymentNumber: input.firstPaymentNumber,
					scheduledDate: finalPayoffDate,
				}),
			],
			sliderBounds,
		};
	}

	if (sliderBounds.maxInterestRows < 1) {
		return emptyResult([
			{
				code: "insufficient_cadence_slots",
				message:
					"Selected start date and frequency do not leave room for both interest collection and final principal payoff before the deadline.",
			},
		]);
	}

	if (
		input.interestPaymentAmount < sliderBounds.minInterestPaymentAmount ||
		input.interestPaymentAmount > sliderBounds.maxInterestPaymentAmount
	) {
		return emptyResult([
			{
				code: "invalid_interest_amount",
				message: `Interest payment amount must be between ${formatCadAmount(
					sliderBounds.minInterestPaymentAmount
				)} and ${formatCadAmount(
					sliderBounds.maxInterestPaymentAmount
				)} for the selected cadence.`,
			},
		]);
	}

	if (
		input.replacementRail === "provider_managed_rotessa" &&
		input.outstandingInterestAmount % input.interestPaymentAmount !== 0
	) {
		return emptyResult([
			{
				code: "provider_uniform_interest_amount_required",
				message:
					"Provider-managed Rotessa schedules require the selected interest amount to divide the outstanding interest exactly.",
			},
		]);
	}

	const interestInstallmentCount = Math.ceil(
		input.outstandingInterestAmount / input.interestPaymentAmount
	);
	const interestExecutionMode =
		input.replacementRail === "provider_managed_rotessa"
			? "provider_managed"
			: "app_owned";
	const rows: ScheduleReplacementPreviewRow[] = [];
	let remainingInterest = input.outstandingInterestAmount;

	for (let index = 0; index < interestInstallmentCount; index += 1) {
		const paymentNumber = input.firstPaymentNumber + index;
		const amount = Math.min(input.interestPaymentAmount, remainingInterest);
		const scheduledDate = cadenceDates[index];
		rows.push({
			amount,
			dueDate: scheduledDate,
			editableDate: input.replacementRail === "app_managed_manual",
			executionMode: interestExecutionMode,
			kind: "replacement_interest",
			obligationType: "regular_interest",
			paymentNumber,
			rowKey: `generated-interest-${paymentNumber}`,
			scheduledDate,
			status: "generated",
		});
		remainingInterest -= amount;
	}

	const finalPaymentNumber =
		input.firstPaymentNumber + interestInstallmentCount;
	const finalPayoffDate = cadenceDates[interestInstallmentCount];
	rows.push(
		buildGeneratedPrincipalRow({
			amount: input.principalPayoffAmount,
			paymentNumber: finalPaymentNumber,
			scheduledDate: finalPayoffDate,
		})
	);

	return {
		finalPayoffDate,
		interestInstallmentCount,
		issues: [],
		rows,
		sliderBounds,
	};
}
