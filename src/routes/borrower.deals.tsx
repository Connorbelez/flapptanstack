import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ParticipantDealsQueuePage } from "#/components/deals/participant/ParticipantDealsQueuePage";
import { api } from "../../convex/_generated/api";

const sellerQueueQueryOptions = convexQuery(
	api.deals.queries.getParticipantDealQueue,
	{ persona: "seller" }
);

// Route tree: run `npx @tanstack/router-cli generate` to sync types after new routes
export const Route = createFileRoute("/borrower/deals")({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(sellerQueueQueryOptions);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { data } = useSuspenseQuery(sellerQueueQueryOptions);
	return <ParticipantDealsQueuePage queue={data} />;
}
