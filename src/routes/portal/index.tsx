import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	toMicMortgageDetail,
	toMicPortfolioSnapshot,
} from "#/components/mic/portal/adapters";
import { MicPortfolioPage } from "#/components/mic/portal/MicPortfolioPage";
import {
	micPortfolioCommandCenterQueryOptions,
	micPortfolioPositionDetailQueryOptions,
} from "#/components/mic/portal/query-options";
import {
	cleanMicPortfolioSearch,
	parseMicPortfolioSearch,
} from "#/components/mic/portal/search";
import type { MicPortfolioFilterState } from "#/components/mic/portal/types";
import { assertActivePortalId } from "#/lib/portal/active-portal";
import { Route as RootRoute } from "../__root";

const MIC_PORTAL_INDEX_ROUTE_PATH = "/portal/";

export const Route = createFileRoute("/portal/")({
	component: MicPortalIndexRouteContent,
	loader: async ({ context }) => {
		const portalId = assertActivePortalId(
			context.portalContext,
			"MIC portal requires an active portal host."
		);
		await context.queryClient.ensureQueryData(
			micPortfolioCommandCenterQueryOptions(portalId)
		);
	},
	validateSearch: (search: Record<string, unknown>) =>
		parseMicPortfolioSearch(search),
});

function MicPortalIndexRouteContent() {
	const navigate = useNavigate();
	const search = Route.useSearch() as MicPortfolioFilterState;
	const { portalContext } = RootRoute.useRouteContext();
	const portalId = assertActivePortalId(
		portalContext,
		"MIC portal requires an active portal host."
	);
	const { data } = useSuspenseQuery(
		micPortfolioCommandCenterQueryOptions(portalId)
	);
	const selectedDetailQuery = useQuery({
		...micPortfolioPositionDetailQueryOptions(
			portalId,
			search.detailMortgageId ?? ""
		),
		enabled: Boolean(search.detailMortgageId),
	});

	return (
		<MicPortfolioPage
			filters={search}
			onFiltersChange={(updater) =>
				void navigate({
					search: (current: MicPortfolioFilterState) =>
						cleanMicPortfolioSearch(updater(current)),
					to: MIC_PORTAL_INDEX_ROUTE_PATH,
				} as never)
			}
			onOpenMortgagePage={(mortgageId) =>
				void navigate({
					params: { mortgageId },
					search,
					to: "/portal/mortgages/$mortgageId",
				})
			}
			selectedMortgageDetail={
				selectedDetailQuery.data
					? toMicMortgageDetail(selectedDetailQuery.data)
					: null
			}
			snapshot={toMicPortfolioSnapshot(data)}
		/>
	);
}
