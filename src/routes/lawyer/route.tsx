import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Authenticated, AuthLoading } from "convex/react";
import { AppRoutePendingScreen } from "#/components/AppRoutePendingScreen";
import { guardRouteAccess } from "#/lib/auth";

export const Route = createFileRoute("/lawyer")({
	beforeLoad: guardRouteAccess("lawyer"),
	component: LawyerLayout,
});

export function LawyerLayout() {
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
