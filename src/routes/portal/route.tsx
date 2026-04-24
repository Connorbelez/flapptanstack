import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Authenticated, AuthLoading } from "convex/react";
import { AppRoutePendingScreen } from "#/components/AppRoutePendingScreen";
import { guardPermission } from "#/lib/auth";

export const Route = createFileRoute("/portal")({
	beforeLoad: guardPermission("micPortal"),
	component: MicPortalRouteComponent,
});

function MicPortalRouteComponent() {
	return (
		<>
			<Authenticated>
				<Outlet />
			</Authenticated>
			<AuthLoading>
				<AppRoutePendingScreen />
			</AuthLoading>
		</>
	);
}
