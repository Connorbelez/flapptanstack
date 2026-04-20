import { createFileRoute } from "@tanstack/react-router";
import { BrokerDealDetailPage } from "#/components/broker/deals/BrokerDealDetailPage";
import { guardRouteAccess } from "#/lib/auth";

export const Route = createFileRoute("/broker/deals/$dealId")({
	beforeLoad: guardRouteAccess("broker"),
	component: BrokerDealDetailRoute,
});

function BrokerDealDetailRoute() {
	const { dealId } = Route.useParams();

	return <BrokerDealDetailPage dealId={dealId} />;
}
