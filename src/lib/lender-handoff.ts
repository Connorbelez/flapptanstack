export type LenderLandingSource =
	| "featured-listing"
	| "switchboard"
	| "view-all";

export const LENDER_HANDOFF_START_PATH = "/start-lending";
export const LENDER_HANDOFF_COMPLETE_PATH = "/start-lending/complete";
export const LENDER_HANDOFF_POST_AUTH_PATH = "/listings";

export function normalizeLenderLandingSource(
	source: unknown
): LenderLandingSource {
	return source === "featured-listing" ||
		source === "switchboard" ||
		source === "view-all"
		? source
		: "switchboard";
}

function appendHandoffSearchParams(
	params: URLSearchParams,
	args: { listingId?: string | undefined; source?: LenderLandingSource }
) {
	if (args.source) {
		params.set("source", args.source);
	}
	if (args.listingId) {
		params.set("listingId", args.listingId);
	}
}

export function buildLenderHandoffStartPath(
	args: { listingId?: string | undefined; source?: LenderLandingSource } = {}
) {
	const params = new URLSearchParams();
	appendHandoffSearchParams(params, args);
	const query = params.toString();
	return query
		? `${LENDER_HANDOFF_START_PATH}?${query}`
		: LENDER_HANDOFF_START_PATH;
}

export function buildLenderHandoffCompletePath(args: {
	listingId?: string | undefined;
	source: LenderLandingSource;
}) {
	const params = new URLSearchParams();
	appendHandoffSearchParams(params, args);
	return `${LENDER_HANDOFF_COMPLETE_PATH}?${params.toString()}`;
}
