import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Authenticated, AuthLoading } from "convex/react";
import { AppRoutePendingScreen } from "#/components/AppRoutePendingScreen";
import { guardRouteAccess } from "#/lib/auth";

export const Route = createFileRoute("/borrower")({
	beforeLoad: guardRouteAccess("borrower"),
	component: BorrowerLayout,
});

export function BorrowerLayout() {
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
