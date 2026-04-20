import type { AuthContextType } from "@workos/authkit-tanstack-react-start/client";
import { buildHostAwareSignOutReturnTo } from "#/lib/portal/auth-routing";
import { handleWorkosSignOut } from "#/lib/workos-sign-out";
import { Route as RootRoute } from "#/routes/__root";

export function useHostAwareSignOut(
	signOut: AuthContextType["signOut"],
	options?: {
		onError?: (message: string) => void;
	}
) {
	const { portalContext } = RootRoute.useRouteContext();
	const returnTo = buildHostAwareSignOutReturnTo(portalContext);

	return () =>
		handleWorkosSignOut(signOut, {
			onError: options?.onError,
			returnTo,
		});
}
