import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { MicPositionFilters } from "../../../convex/micPortfolio/contracts";

export function micDashboardSnapshotQueryOptions(portalId: Id<"portals">) {
	return convexQuery(api.micPortfolio.queries.getMicDashboardSnapshot, {
		portalId,
	});
}

export function micPositionsQueryOptions(
	portalId: Id<"portals">,
	filters?: MicPositionFilters
) {
	return convexQuery(api.micPortfolio.queries.getMicPositions, {
		portalId,
		filters,
	});
}

export function micPositionDetailQueryOptions(
	portalId: Id<"portals">,
	mortgageId: Id<"mortgages">
) {
	return convexQuery(api.micPortfolio.queries.getMicPositionDetail, {
		portalId,
		mortgageId,
	});
}

export function micPaymentsHistoryQueryOptions(
	portalId: Id<"portals">,
	mortgageId?: Id<"mortgages">
) {
	return convexQuery(api.micPortfolio.queries.getMicPaymentsHistory, {
		portalId,
		mortgageId,
	});
}

export function micConcentrationExposureQueryOptions(portalId: Id<"portals">) {
	return convexQuery(api.micPortfolio.queries.getMicConcentrationExposure, {
		portalId,
	});
}
