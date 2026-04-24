import { createFileRoute } from "@tanstack/react-router";
import { BrokerOnboardingReviewPage } from "#/components/admin/broker-onboarding/BrokerOnboardingReviewPage";
import {
	AdminPageSkeleton,
	AdminRouteErrorBoundary,
} from "#/components/admin/shell/AdminRouteStates";
import { guardRouteAccess } from "#/lib/auth";

export const Route = createFileRoute("/admin/broker-onboarding")({
	beforeLoad: guardRouteAccess("adminBrokerOnboarding"),
	component: BrokerOnboardingReviewPage,
	errorComponent: AdminRouteErrorBoundary,
	pendingComponent: BrokerOnboardingPendingPage,
});

function BrokerOnboardingPendingPage() {
	return <AdminPageSkeleton descriptionWidth="w-64" titleWidth="w-52" />;
}
