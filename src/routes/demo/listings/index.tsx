import { createFileRoute } from "@tanstack/react-router";
import { MarketplaceReplicaPage } from "#/components/demo/listings/MarketplaceReplicaPage";

export const Route = createFileRoute("/demo/listings/")({
	component: DemoListingsIndexRouteComponent,
});

function DemoListingsIndexRouteComponent() {
	return <MarketplaceReplicaPage />;
}
