import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Authenticated, AuthLoading } from "convex/react";
import { AppRoutePendingScreen } from "#/components/AppRoutePendingScreen";

export const Route = createFileRoute("/deals")({
	component: DealLayout,
});

export function DealLayout() {
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
