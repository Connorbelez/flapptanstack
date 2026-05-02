import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Authenticated, AuthLoading } from "convex/react";
import { AppRoutePendingScreen } from "#/components/AppRoutePendingScreen";
import { guardRouteAccess } from "#/lib/auth";

export const Route = createFileRoute("/files")({
	beforeLoad: guardRouteAccess("files"),
	component: FilesLayout,
});

export function FilesLayout() {
	return (
		<div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
			<Authenticated>
				<div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
					<Outlet />
				</div>
			</Authenticated>
			<AuthLoading>
				<AppRoutePendingScreen />
			</AuthLoading>
		</div>
	);
}
