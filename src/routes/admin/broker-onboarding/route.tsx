import { createFileRoute } from "@tanstack/react-router";
import { guardRouteAccess } from "#/lib/auth";

export const Route = createFileRoute("/admin/broker-onboarding")({
	beforeLoad: guardRouteAccess("adminBrokerOnboarding"),
});
