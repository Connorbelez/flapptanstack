import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../../../convex/_generated/api";
import { buildOfflinePaymentOperationsQueryArgs } from "./search";
import type { OfflinePaymentOperationsSearchState } from "./types";

export function offlinePaymentOperationsQueryOptions(
	search: OfflinePaymentOperationsSearchState
) {
	return convexQuery(
		api.payments.offlineOperations.getOfflinePaymentOperationsSnapshot,
		buildOfflinePaymentOperationsQueryArgs(search)
	);
}
