export const replacementRailLabels = {
	app_managed_manual: "Manual collection",
	provider_managed_rotessa: "Rotessa PAD",
} as const;

export const replacementRailGroups = [
	{
		label: "App managed",
		options: ["app_managed_manual"],
	},
	{
		label: "Provider managed",
		options: ["provider_managed_rotessa"],
	},
] as const;

export const replacementFrequencyLabels = {
	accelerated_bi_weekly: "Accelerated bi-weekly",
	bi_weekly: "Bi-weekly",
	monthly: "Monthly",
	weekly: "Weekly",
} as const;

export function formatPaymentScheduleMoney(amount: number) {
	return new Intl.NumberFormat("en-CA", {
		currency: "CAD",
		maximumFractionDigits: 2,
		minimumFractionDigits: 2,
		style: "currency",
	}).format(amount / 100);
}

export function formatPaymentScheduleDate(timestamp: number) {
	return new Intl.DateTimeFormat("en-GB", {
		day: "2-digit",
		month: "short",
		timeZone: "UTC",
		year: "numeric",
	}).format(new Date(timestamp));
}

export function toUtcDate(timestamp: number) {
	return new Date(timestamp);
}

export function fromUtcDate(date: Date) {
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
