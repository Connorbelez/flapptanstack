import { createFileRoute } from "@tanstack/react-router";
import { AdminRecordDetailPage } from "#/components/admin/shell/AdminRecordDetailPage";
import { AdminNotFoundState } from "#/components/admin/shell/AdminRouteStates";
import { VelocityWorkspacePage } from "#/components/admin/velocity/VelocityWorkspacePage";
import { isReservedAdminRouteSegment } from "#/lib/admin-entities";

export const Route = createFileRoute("/admin/$entitytype/$recordid")({
	component: RouteComponent,
});

function RouteComponent() {
	const { entitytype, recordid } = Route.useParams();

	if (isReservedAdminRouteSegment(entitytype)) {
		return <AdminNotFoundState entityType={entitytype} variant="entity" />;
	}

	if (entitytype === "velocity") {
		return <VelocityWorkspacePage workspaceId={recordid} />;
	}

	return <AdminRecordDetailPage entityType={entitytype} recordId={recordid} />;
}
