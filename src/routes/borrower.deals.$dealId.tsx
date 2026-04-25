import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { ParticipantDealWorkspacePage } from "#/components/deals/participant/ParticipantDealWorkspacePage";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

function sellerWorkspaceQueryOptions(dealId: string) {
	return convexQuery(api.deals.queries.getParticipantDealWorkspace, {
		dealId: dealId as Id<"deals">,
		persona: "seller",
	});
}

// Route tree: see borrower.deals.tsx
export const Route = createFileRoute(
	// @ts-expect-error file route key missing from routeTree.gen until generator picks up this module
	"/borrower/deals/$dealId"
)({
	loader: async ({ context, params }) => {
		const { dealId } = params as { dealId: string };
		const workspace = await context.queryClient.ensureQueryData(
			sellerWorkspaceQueryOptions(dealId)
		);
		if (!workspace) {
			throw notFound();
		}
		return { dealId };
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { dealId } = Route.useParams() as { dealId: string };
	const { data } = useSuspenseQuery(sellerWorkspaceQueryOptions(dealId));
	if (!data) {
		throw notFound();
	}
	return (
		<ParticipantDealWorkspacePage backTo="/borrower/deals" workspace={data} />
	);
}
