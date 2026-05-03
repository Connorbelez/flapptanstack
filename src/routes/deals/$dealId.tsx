import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Authenticated, AuthLoading } from "convex/react";
import { AppRoutePendingScreen } from "#/components/AppRoutePendingScreen";
import { DealPortalPage } from "#/components/deals/portal/DealPortalPage";
import { guardAuthenticated } from "#/lib/auth";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function dealPortalQueryOptions(dealId: string) {
	return convexQuery(api.deals.portalQueries.getDealPortalWorkspace, {
		dealId: dealId as Id<"deals">,
	});
}

export const Route = createFileRoute("/deals/$dealId")({
	beforeLoad: guardAuthenticated(),
	loader: async ({ context, params }) => {
		const workspace = await context.queryClient.ensureQueryData(
			dealPortalQueryOptions(params.dealId)
		);
		if (!workspace) {
			throw notFound();
		}
		return { dealId: params.dealId };
	},
	component: DealPortalRouteComponent,
});

export function DealPortalRouteComponent() {
	const { dealId } = Route.useLoaderData();
	const { data } = useSuspenseQuery(dealPortalQueryOptions(dealId));
	if (!data) {
		throw notFound();
	}
	return (
		<>
			<Authenticated>
				<DealPortalPage workspace={data} />
			</Authenticated>
			<AuthLoading>
				<AppRoutePendingScreen />
			</AuthLoading>
		</>
	);
}
