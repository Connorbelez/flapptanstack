import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Authenticated, AuthLoading } from "convex/react";
import { AppRoutePendingScreen } from "#/components/AppRoutePendingScreen";
import { guardRouteAccess } from "#/lib/auth";

export const Route = createFileRoute("/lender")({
	beforeLoad: guardRouteAccess("lender"),
	component: LenderLayout,
});

export function LenderLayout() {
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
