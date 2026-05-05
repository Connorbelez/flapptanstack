import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ParticipantDealsQueuePage } from "#/components/deals/participant/ParticipantDealsQueuePage";
import { api } from "../../convex/_generated/api";

const lenderQueueQueryOptions = convexQuery(
	api.deals.queries.getParticipantDealQueue,
	{ persona: "participating_lender" }
);

export const Route = createFileRoute("/lender/deals")({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(lenderQueueQueryOptions);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { data } = useSuspenseQuery(lenderQueueQueryOptions);
	return <ParticipantDealsQueuePage queue={data} />;
}
