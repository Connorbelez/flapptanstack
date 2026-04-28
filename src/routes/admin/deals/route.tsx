import { createFileRoute, Outlet, useMatch } from "@tanstack/react-router";
import { DealOperationsPipeline } from "#/components/admin/deals/DealOperationsPipeline";
import { AdminRouteErrorBoundary } from "#/components/admin/shell/AdminRouteStates";

export const Route = createFileRoute("/admin/deals")({
	component: EntityList,
	errorComponent: AdminRouteErrorBoundary,
});

function EntityList() {
	const recordId = useMatch({
		from: "/admin/deals/$recordid",
		select: (match) => match.params.recordid,
		shouldThrow: false,
	});

	if (recordId) {
		return <Outlet />;
	}

	return <DealOperationsPipeline />;
}
