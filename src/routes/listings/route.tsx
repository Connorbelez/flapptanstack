import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Authenticated, AuthLoading } from "convex/react";
// import { SpinnerIcon } from "lucide-react";
import { AppRoutePendingScreen } from "#/components/AppRoutePendingScreen";
// import { useConvexAuth } from "convex/react";
import { canAccessRoute } from "#/lib/auth";
import { buildSignInRedirect } from "#/lib/auth-redirect";
export const Route = createFileRoute("/listings")({
	beforeLoad: ({ context, location }) => {
		if (!context.userId) {
			throw redirect(buildSignInRedirect(location.href));
		}
		// TODO: Align listings auth with guardRouteAccess / canAccessAdminPath once the race is resolved.
		if (!canAccessRoute("listings", context)) {
			throw redirect({ to: "/unauthorized" });
		}
	},
	component: ListingsLayout,
});

//TODO: THIS SHOULD BE THE DEFAULT PATTERN FOR ALL AUTHENTICATED ROUTES, refactor other routes to use this pattern!!!
function ListingsLayout() {
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
