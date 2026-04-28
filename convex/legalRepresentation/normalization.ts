import type { LawyerVerificationReasonCode } from "./validators";

const NON_ALPHANUMERIC_BAR_CHARS = /[^A-Z0-9]/g;
const MULTIPLE_WHITESPACE = /\s+/g;

export function normalizeLegalWhitespace(value: string): string {
	return value.trim().replace(MULTIPLE_WHITESPACE, " ");
}

export function normalizeLawyerName(value: string): string {
	return normalizeLegalWhitespace(value).toLocaleLowerCase("en-CA");
}

export function normalizeLawyerEmail(value: string): string {
	return value.trim().toLocaleLowerCase("en-CA");
}

export function normalizeBarNumber(value: string): string {
	return value
		.trim()
		.toLocaleUpperCase("en-CA")
		.replace(NON_ALPHANUMERIC_BAR_CHARS, "");
}

export function normalizeJurisdiction(value: string): string {
	return normalizeLegalWhitespace(value).toLocaleUpperCase("en-CA");
}

export function normalizeRestrictionSummary(value: string | undefined) {
	if (value === undefined) {
		return undefined;
	}
	const normalized = normalizeLegalWhitespace(value);
	return normalized.length > 0 ? normalized : undefined;
}

export function normalizeReasonCodes(
	reasonCodes: readonly LawyerVerificationReasonCode[]
): LawyerVerificationReasonCode[] {
	return [...new Set(reasonCodes)].sort();
}

export function normalizeLegalSourceSnapshot(
	sourceSnapshot: Readonly<Record<string, string>>
): Record<string, string> {
	return Object.fromEntries(
		Object.entries(sourceSnapshot)
			.map(([key, value]) => [
				normalizeLegalWhitespace(key),
				normalizeLegalWhitespace(value),
			])
			.filter(([key]) => key.length > 0)
			.sort(([left], [right]) => left.localeCompare(right))
	);
}
