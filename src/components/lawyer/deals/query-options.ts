import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export function lawyerAssignedClosingsQueryOptions() {
	return convexQuery(api.deals.lawyerQueries.listAssignedClosings, {});
}

export function lawyerDealWorkspaceQueryOptions(dealId: Id<"deals">) {
	return convexQuery(api.deals.lawyerQueries.getLawyerDealWorkspace, {
		dealId,
	});
}
