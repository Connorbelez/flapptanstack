import { createFileRoute } from "@tanstack/react-router";
import { BorrowerFinancingApplicationPage } from "#/components/borrower/financing/BorrowerFinancingApplicationPage";
import { parseFinancingPrefill } from "#/lib/portal/financing-prefill";

export const Route = createFileRoute("/borrower/financing/start")({
	component: BorrowerFinancingStartRoute,
	validateSearch: (search: Record<string, unknown>) =>
		parseFinancingPrefill(search),
});

function BorrowerFinancingStartRoute() {
	const prefill = Route.useSearch();

	return <BorrowerFinancingApplicationPage kind="intake" prefill={prefill} />;
}
