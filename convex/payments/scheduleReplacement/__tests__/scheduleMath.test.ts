import { describe, expect, it } from "vitest";
import {
	addCalendarMonths,
	addFrequencyDate,
	buildCadenceDates,
	buildReplacementPreview,
	calculateSliderBounds,
	toIsoBusinessDate,
	toUtcBusinessDate,
} from "../scheduleMath";

describe("scheduleReplacement scheduleMath", () => {
	it("converts UTC business dates and clamps month-end calendar additions", () => {
		const timestamp = toUtcBusinessDate("2026-01-31");

		expect(timestamp).toBe(Date.UTC(2026, 0, 31));
		expect(toIsoBusinessDate(timestamp)).toBe("2026-01-31");
		expect(addCalendarMonths("2026-01-31", 2)).toBe("2026-03-31");
		expect(addCalendarMonths("2026-12-31", 2)).toBe("2027-02-28");
	});

	it("calculates monthly slider bounds while reserving the final payoff cadence", () => {
		const bounds = calculateSliderBounds({
			startDate: toUtcBusinessDate("2026-01-31"),
			deadlineDate: toUtcBusinessDate("2026-04-30"),
			paymentFrequency: "monthly",
			outstandingInterestAmount: 40_000,
		});

		expect(bounds).toEqual({
			maxInterestRows: 3,
			minInterestPaymentAmount: 13_334,
			maxInterestPaymentAmount: 40_000,
			step: 100,
		});
	});

	it("adds frequency dates and only returns cadence dates through the deadline", () => {
		const startDate = toUtcBusinessDate("2026-01-31");

		expect(toIsoBusinessDate(addFrequencyDate(startDate, "monthly"))).toBe(
			"2026-02-28"
		);
		expect(toIsoBusinessDate(addFrequencyDate(startDate, "weekly"))).toBe(
			"2026-02-07"
		);
		expect(toIsoBusinessDate(addFrequencyDate(startDate, "bi_weekly"))).toBe(
			"2026-02-14"
		);
		expect(
			toIsoBusinessDate(addFrequencyDate(startDate, "accelerated_bi_weekly"))
		).toBe("2026-02-14");

		const weeklyDates = buildCadenceDates({
			startDate: toUtcBusinessDate("2026-01-01"),
			deadlineDate: toUtcBusinessDate("2026-01-20"),
			paymentFrequency: "weekly",
		});

		expect(weeklyDates.map(toIsoBusinessDate)).toEqual([
			"2026-01-01",
			"2026-01-08",
			"2026-01-15",
		]);
		expect(
			weeklyDates.every((date) => date <= toUtcBusinessDate("2026-01-20"))
		).toBe(true);
	});

	it("generates app-managed interest rows with a smaller final interest row and an app-owned manual principal row on the next cadence", () => {
		const preview = buildReplacementPreview({
			startDate: toUtcBusinessDate("2026-01-01"),
			deadlineDate: toUtcBusinessDate("2026-04-01"),
			paymentFrequency: "monthly",
			outstandingInterestAmount: 25_000,
			principalPayoffAmount: 1_000_000,
			interestPaymentAmount: 10_000,
			replacementRail: "app_managed_manual",
			firstPaymentNumber: 7,
		});

		expect(preview.issues).toEqual([]);
		expect(preview.interestInstallmentCount).toBe(3);
		expect(toIsoBusinessDate(preview.finalPayoffDate)).toBe("2026-04-01");
		expect(
			preview.rows.map((row) => ({
				amount: row.amount,
				date: toIsoBusinessDate(row.scheduledDate),
				editableDate: row.editableDate,
				executionMode: row.executionMode,
				kind: row.kind,
				obligationType: row.obligationType,
				paymentNumber: row.paymentNumber,
				rowKey: row.rowKey,
				status: row.status,
			}))
		).toEqual([
			{
				amount: 10_000,
				date: "2026-01-01",
				editableDate: true,
				executionMode: "app_owned",
				kind: "replacement_interest",
				obligationType: "regular_interest",
				paymentNumber: 7,
				rowKey: "generated-interest-7",
				status: "generated",
			},
			{
				amount: 10_000,
				date: "2026-02-01",
				editableDate: true,
				executionMode: "app_owned",
				kind: "replacement_interest",
				obligationType: "regular_interest",
				paymentNumber: 8,
				rowKey: "generated-interest-8",
				status: "generated",
			},
			{
				amount: 5000,
				date: "2026-03-01",
				editableDate: true,
				executionMode: "app_owned",
				kind: "replacement_interest",
				obligationType: "regular_interest",
				paymentNumber: 9,
				rowKey: "generated-interest-9",
				status: "generated",
			},
			{
				amount: 1_000_000,
				date: "2026-04-01",
				editableDate: false,
				executionMode: "app_owned",
				kind: "replacement_principal",
				obligationType: "principal_repayment",
				paymentNumber: 10,
				rowKey: "generated-principal-10",
				status: "generated",
			},
		]);
	});

	it("blocks provider-managed previews when Rotessa cannot represent equal interest installments", () => {
		const preview = buildReplacementPreview({
			startDate: toUtcBusinessDate("2026-01-01"),
			deadlineDate: toUtcBusinessDate("2026-04-01"),
			paymentFrequency: "monthly",
			outstandingInterestAmount: 25_000,
			principalPayoffAmount: 1_000_000,
			interestPaymentAmount: 10_000,
			replacementRail: "provider_managed_rotessa",
			firstPaymentNumber: 7,
		});

		expect(preview.rows).toEqual([]);
		expect(preview.issues).toEqual([
			{
				code: "provider_uniform_interest_amount_required",
				message:
					"Provider-managed Rotessa schedules require the selected interest amount to divide the outstanding interest exactly.",
			},
		]);
	});

	it("marks app-managed generated interest rows editable but final principal not editable", () => {
		const preview = buildReplacementPreview({
			startDate: toUtcBusinessDate("2026-01-05"),
			deadlineDate: toUtcBusinessDate("2026-01-19"),
			paymentFrequency: "weekly",
			outstandingInterestAmount: 10_000,
			principalPayoffAmount: 250_000,
			interestPaymentAmount: 10_000,
			replacementRail: "app_managed_manual",
			firstPaymentNumber: 1,
		});

		expect(preview.issues).toEqual([]);
		expect(preview.rows).toHaveLength(2);
		expect(preview.rows[0]).toMatchObject({
			editableDate: true,
			executionMode: "app_owned",
			kind: "replacement_interest",
			rowKey: "generated-interest-1",
		});
		expect(preview.rows[1]).toMatchObject({
			editableDate: false,
			executionMode: "app_owned",
			kind: "replacement_principal",
			rowKey: "generated-principal-2",
		});
	});

	it("builds a principal-only preview when no outstanding interest remains", () => {
		const preview = buildReplacementPreview({
			startDate: toUtcBusinessDate("2026-01-05"),
			deadlineDate: toUtcBusinessDate("2026-02-05"),
			paymentFrequency: "monthly",
			outstandingInterestAmount: 0,
			principalPayoffAmount: 250_000,
			interestPaymentAmount: 0,
			replacementRail: "provider_managed_rotessa",
			firstPaymentNumber: 12,
		});

		expect(preview.issues).toEqual([]);
		expect(preview.interestInstallmentCount).toBe(0);
		expect(toIsoBusinessDate(preview.finalPayoffDate)).toBe("2026-01-05");
		expect(preview.rows).toEqual([
			{
				amount: 250_000,
				dueDate: toUtcBusinessDate("2026-01-05"),
				editableDate: false,
				executionMode: "app_owned",
				kind: "replacement_principal",
				obligationType: "principal_repayment",
				paymentNumber: 12,
				rowKey: "generated-principal-12",
				scheduledDate: toUtcBusinessDate("2026-01-05"),
				status: "generated",
			},
		]);
	});

	it("returns insufficient cadence slots for principal-only previews with no available cadence date", () => {
		const preview = buildReplacementPreview({
			startDate: toUtcBusinessDate("2026-02-01"),
			deadlineDate: toUtcBusinessDate("2026-01-31"),
			paymentFrequency: "monthly",
			outstandingInterestAmount: 0,
			principalPayoffAmount: 250_000,
			interestPaymentAmount: 0,
			replacementRail: "app_managed_manual",
			firstPaymentNumber: 12,
		});

		expect(preview.rows).toEqual([]);
		expect(preview.issues).toEqual([
			{
				code: "insufficient_cadence_slots",
				message:
					"Selected start date and frequency do not leave room for both interest collection and final principal payoff before the deadline.",
			},
		]);
	});

	it("returns an insufficient cadence slots issue when there is no room for interest and principal rows", () => {
		const preview = buildReplacementPreview({
			startDate: toUtcBusinessDate("2026-01-01"),
			deadlineDate: toUtcBusinessDate("2026-01-01"),
			paymentFrequency: "monthly",
			outstandingInterestAmount: 10_000,
			principalPayoffAmount: 100_000,
			interestPaymentAmount: 10_000,
			replacementRail: "app_managed_manual",
			firstPaymentNumber: 1,
		});

		expect(preview.rows).toEqual([]);
		expect(preview.issues).toEqual([
			{
				code: "insufficient_cadence_slots",
				message:
					"Selected start date and frequency do not leave room for both interest collection and final principal payoff before the deadline.",
			},
		]);
	});

	it("returns an invalid amount issue when the interest payment is outside slider bounds", () => {
		const preview = buildReplacementPreview({
			startDate: toUtcBusinessDate("2026-01-01"),
			deadlineDate: toUtcBusinessDate("2026-05-01"),
			paymentFrequency: "monthly",
			outstandingInterestAmount: 40_000,
			principalPayoffAmount: 100_000,
			interestPaymentAmount: 5000,
			replacementRail: "app_managed_manual",
			firstPaymentNumber: 1,
		});

		expect(preview.rows).toEqual([]);
		expect(preview.issues).toEqual([
			{
				code: "invalid_interest_amount",
				message:
					"Interest payment amount must be between $100.00 and $400.00 for the selected cadence.",
			},
		]);
	});
});
