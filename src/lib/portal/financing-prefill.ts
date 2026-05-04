export type FinancingContinuationKind = "intake" | "pre-approval";

export interface FinancingPrefill {
	amountNeeded?: string;
	email?: string;
	fullName?: string;
}

function optionalString(value: unknown) {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function appendPrefillParam(
	searchParams: URLSearchParams,
	key: keyof FinancingPrefill,
	value: string | undefined
) {
	if (value) {
		searchParams.set(key, value);
	}
}

export function parseFinancingPrefill(
	search: Record<string, unknown>
): FinancingPrefill {
	return {
		amountNeeded: optionalString(search.amountNeeded),
		email: optionalString(search.email),
		fullName: optionalString(search.fullName),
	};
}

export function getFinancingRoutePath(kind: FinancingContinuationKind) {
	return kind === "pre-approval"
		? "/financing/pre-approval"
		: "/financing/start";
}

export function getBorrowerFinancingRoutePath(kind: FinancingContinuationKind) {
	return kind === "pre-approval"
		? "/borrower/financing/pre-approval"
		: "/borrower/financing/start";
}

function buildReturnPath(routePath: string, prefill: FinancingPrefill) {
	const searchParams = new URLSearchParams();
	appendPrefillParam(searchParams, "fullName", prefill.fullName);
	appendPrefillParam(searchParams, "email", prefill.email);
	appendPrefillParam(searchParams, "amountNeeded", prefill.amountNeeded);

	const queryString = searchParams.toString();

	return queryString ? `${routePath}?${queryString}` : routePath;
}

export function buildFinancingReturnPath(
	kind: FinancingContinuationKind,
	prefill: FinancingPrefill
) {
	return buildReturnPath(getFinancingRoutePath(kind), prefill);
}

export function buildBorrowerFinancingReturnPath(
	kind: FinancingContinuationKind,
	prefill: FinancingPrefill
) {
	return buildReturnPath(getBorrowerFinancingRoutePath(kind), prefill);
}
