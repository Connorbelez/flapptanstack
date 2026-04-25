import { createFileRoute } from "@tanstack/react-router";
import { PortalFinancingStartPage } from "#/components/portal/financing/PortalFinancingStartPage";
import { assertActivePortalId } from "#/lib/portal/active-portal";
import { parseFinancingPrefill } from "#/lib/portal/financing-prefill";
import { Route as RootRoute } from "./__root";

export const Route = createFileRoute("/financing/pre-approval")({
	component: FinancingPreApprovalRoute,
	validateSearch: (search: Record<string, unknown>) =>
		parseFinancingPrefill(search),
});

function FinancingPreApprovalRoute() {
	const prefill = Route.useSearch();
	const { portalContext } = RootRoute.useRouteContext();
	assertActivePortalId(
		portalContext,
		"Pre-approval starts require an active portal host."
	);
	if (portalContext.kind !== "portal") {
		throw new Error("Pre-approval starts require an active portal host.");
	}

	return (
		<PortalFinancingStartPage
			kind="pre-approval"
			portalContext={portalContext}
			prefill={prefill}
		/>
	);
}
