import { createFileRoute } from "@tanstack/react-router";
import { PortalFinancingStartPage } from "#/components/portal/financing/PortalFinancingStartPage";
import { assertActivePortalId } from "#/lib/portal/active-portal";
import { parseFinancingPrefill } from "#/lib/portal/financing-prefill";
import { Route as RootRoute } from "./__root";

export const Route = createFileRoute("/financing/start")({
	component: FinancingStartRoute,
	validateSearch: (search: Record<string, unknown>) =>
		parseFinancingPrefill(search),
});

function FinancingStartRoute() {
	const prefill = Route.useSearch();
	const { portalContext } = RootRoute.useRouteContext();
	assertActivePortalId(
		portalContext,
		"Financing starts require an active portal host."
	);
	if (portalContext.kind !== "portal") {
		throw new Error("Financing starts require an active portal host.");
	}

	return (
		<PortalFinancingStartPage
			kind="intake"
			portalContext={portalContext}
			prefill={prefill}
		/>
	);
}
