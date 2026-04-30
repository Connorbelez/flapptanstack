import { createLazyFileRoute } from "@tanstack/react-router";
import { BrokerOnboardingReviewPage } from "#/components/admin/broker-onboarding/BrokerOnboardingReviewPage";
import {
	AdminPageSkeleton,
	AdminRouteErrorBoundary,
} from "#/components/admin/shell/AdminRouteStates";

export const Route = createLazyFileRoute("/admin/broker-onboarding")({
	component: BrokerOnboardingReviewPage,
	errorComponent: AdminRouteErrorBoundary,
	pendingComponent: BrokerOnboardingPendingPage,
});

function BrokerOnboardingPendingPage() {
	return <AdminPageSkeleton descriptionWidth="w-64" titleWidth="w-52" />;
}
