import { businessDateToUnixMs } from "../lib/businessDates";

export const LENDER_RENEWAL_CREATE_WINDOW_DAYS = 180;
export const LENDER_RENEWAL_SIGNAL_DEADLINE_DAYS = 60;
export const LENDER_RENEWAL_PARTIAL_EXIT_MIN_FRACTIONS = 100;

export const LENDER_RENEWAL_INTENT_VALUES = [
	"renew",
	"exit",
	"partial_exit",
] as const;

export type LenderRenewalIntentChoice =
	(typeof LENDER_RENEWAL_INTENT_VALUES)[number];

export const LENDER_RENEWAL_STATUS_VALUES = [
	"pending_signal",
	"renewed",
	"exiting",
	"expired",
] as const;

export type LenderRenewalIntentStatus =
	(typeof LENDER_RENEWAL_STATUS_VALUES)[number];

const HALF_DAY_MS = 12 * 60 * 60 * 1000;

export function addDaysToBusinessDate(
	dateString: string,
	days: number
): string {
	const date = new Date(`${dateString}T00:00:00.000Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

export function businessDateToNoonUtcMs(dateString: string): number {
	return businessDateToUnixMs(dateString) + HALF_DAY_MS;
}

export function buildLenderRenewalTimeline(maturityDate: string) {
	const creationWindowOpensOn = addDaysToBusinessDate(
		maturityDate,
		-LENDER_RENEWAL_CREATE_WINDOW_DAYS
	);
	const signalDeadlineOn = addDaysToBusinessDate(
		maturityDate,
		-LENDER_RENEWAL_SIGNAL_DEADLINE_DAYS
	);

	return {
		creationWindowOpensOn,
		creationWindowOpensAt: businessDateToNoonUtcMs(creationWindowOpensOn),
		signalDeadlineOn,
		signalDeadlineAt: businessDateToNoonUtcMs(signalDeadlineOn),
		maturityAt: businessDateToNoonUtcMs(maturityDate),
	};
}

export function isLenderRenewalWindowOpen(args: {
	asOf: number;
	maturityDate: string;
}) {
	const timeline = buildLenderRenewalTimeline(args.maturityDate);
	return (
		args.asOf >= timeline.creationWindowOpensAt &&
		args.asOf < timeline.signalDeadlineAt &&
		args.asOf < timeline.maturityAt
	);
}

export function renewalSignalEventForIntent(intent: LenderRenewalIntentChoice) {
	switch (intent) {
		case "renew":
			return "LENDER_SIGNALS_RENEW" as const;
		case "exit":
			return "LENDER_SIGNALS_EXIT" as const;
		case "partial_exit":
			return "LENDER_SIGNALS_PARTIAL_EXIT" as const;
		default:
			throw new Error(`Unsupported lender renewal intent: ${intent}`);
	}
}
