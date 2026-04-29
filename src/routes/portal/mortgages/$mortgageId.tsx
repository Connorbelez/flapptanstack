import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toMicMortgageDetailPage } from "#/components/mic/portal/adapters";
import { MicMortgageDetailPage } from "#/components/mic/portal/MicMortgageDetailPage";
import { micPortfolioMortgageDetailPageQueryOptions } from "#/components/mic/portal/query-options";
import { DEFAULT_MIC_PORTFOLIO_FILTER_STATE } from "#/components/mic/portal/types";
import { assertActivePortalId } from "#/lib/portal/active-portal";
import { Route as RootRoute } from "../../__root";

export const Route = createFileRoute("/portal/mortgages/$mortgageId")({
	component: MicMortgageDetailRouteContent,
	loader: async ({ context, params }) => {
		const portalId = assertActivePortalId(
			context.portalContext,
			"MIC mortgage detail requires an active portal host."
		);
		await context.queryClient.ensureQueryData(
			micPortfolioMortgageDetailPageQueryOptions(portalId, params.mortgageId)
		);
	},
});

function MicMortgageDetailRouteContent() {
	const navigate = useNavigate();
	const { mortgageId } = Route.useParams();
	const { portalContext } = RootRoute.useRouteContext();
	const portalId = assertActivePortalId(
		portalContext,
		"MIC mortgage detail requires an active portal host."
	);
	const { data } = useSuspenseQuery(
		micPortfolioMortgageDetailPageQueryOptions(portalId, mortgageId)
	);

	return (
		<MicMortgageDetailPage
			detail={toMicMortgageDetailPage(data)}
			onBackToPortfolio={() =>
				void navigate({
					search: DEFAULT_MIC_PORTFOLIO_FILTER_STATE,
					to: "/portal",
				})
			}
		/>
	);
}
