import { createFileRoute } from "@tanstack/react-router";
import { BorrowerFinancingApplicationPage } from "#/components/borrower/financing/BorrowerFinancingApplicationPage";
import { parseFinancingPrefill } from "#/lib/portal/financing-prefill";

export const Route = createFileRoute("/borrower/financing/pre-approval")({
	component: BorrowerFinancingPreApprovalRoute,
	validateSearch: (search: Record<string, unknown>) =>
		parseFinancingPrefill(search),
});

function BorrowerFinancingPreApprovalRoute() {
	const prefill = Route.useSearch();

	return (
		<BorrowerFinancingApplicationPage kind="pre-approval" prefill={prefill} />
	);
}
