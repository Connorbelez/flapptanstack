import { createFileRoute } from "@tanstack/react-router";
import {
	AdminPageSkeleton,
	AdminRouteErrorBoundary,
} from "#/components/admin/shell/AdminRouteStates";
import { VelocityFinalReviewPage } from "#/components/admin/velocity/VelocityFinalReviewPage";
import { guardRouteAccess } from "#/lib/auth";

export const Route = createFileRoute("/admin/velocity/$workspaceId/review")({
	beforeLoad: guardRouteAccess("adminVelocityPackages"),
	component: RouteComponent,
	errorComponent: AdminRouteErrorBoundary,
	pendingComponent: VelocityFinalReviewPendingPage,
});

function RouteComponent() {
	const { workspaceId } = Route.useParams();

	return <VelocityFinalReviewPage workspaceId={workspaceId} />;
}

function VelocityFinalReviewPendingPage() {
	return <AdminPageSkeleton descriptionWidth="w-72" titleWidth="w-64" />;
}
