import { createFileRoute } from "@tanstack/react-router";
import { DealOperationsConsole } from "#/components/admin/deals/DealOperationsConsole";
import {
	AdminPageSkeleton,
	AdminRouteErrorBoundary,
} from "#/components/admin/shell/AdminRouteStates";
import type { Id } from "../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/admin/deals/$recordid")({
	component: RouteComponent,
	errorComponent: AdminRouteErrorBoundary,
	pendingComponent: DealDetailPendingPage,
});

function RouteComponent() {
	const { recordid } = Route.useParams();

	return <DealOperationsConsole dealId={recordid as Id<"deals">} />;
}

function DealDetailPendingPage() {
	return <AdminPageSkeleton descriptionWidth="w-64" titleWidth="w-56" />;
}
