import type { AuthContextType } from "@workos/authkit-tanstack-react-start/client";
import {
	buildHostAwareSignOutReturnTo,
	buildLocalSessionSignOutHref,
	resolvePortalHostTypeFromHost,
} from "#/lib/portal/auth-routing";
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
	const shouldUseLocalSessionSignOut =
		resolvePortalHostTypeFromHost(new URL(returnTo).host) === "local";

	return async () => {
		if (shouldUseLocalSessionSignOut) {
			window.location.assign(buildLocalSessionSignOutHref(returnTo));
			return;
		}

		await handleWorkosSignOut(signOut, {
			onError: options?.onError,
			returnTo,
		});
	};
}
