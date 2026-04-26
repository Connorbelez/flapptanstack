import { createServerFn } from "@tanstack/react-start";
import {
	getSignInUrl,
	getSignUpUrl,
} from "@workos/authkit-tanstack-react-start";
import { getReturnPathname } from "#/lib/auth-redirect";
import { portalRequestMiddleware } from "#/lib/portal/request-host";
import {
	buildHostAwareAuthRequest,
	requiresHostAwareAuthState,
} from "./auth-routing";
import {
	buildPortalAuthStatePayload,
	getPortalAuthStateSecret,
	signPortalAuthState,
} from "./auth-state";
import { resolveRootPortalContext } from "./host-resolution";
import { resolveRouteHostPolicy } from "./route-host-policy";

type AuthFlow = "sign-in" | "sign-up";

export const getHostAwareAuthUrl = createServerFn({ method: "GET" })
	.middleware([portalRequestMiddleware])
	.inputValidator(
		(input: { flow: AuthFlow; redirectTarget?: string | undefined }) => input
	)
	.handler(async ({ context, data }) => {
		const portalContext = await resolveRootPortalContext({
			requestHost: context.requestHost,
			token: null,
		});

		if (
			portalContext.kind === "reserved" ||
			portalContext.kind === "unknown" ||
			(portalContext.kind === "portal" &&
				portalContext.availability !== "active")
		) {
			throw new Error(
				`Cannot start auth from unavailable host "${portalContext.requestedHost}".`
			);
		}

		const routePolicy = resolveRouteHostPolicy(
			getReturnPathname(data.redirectTarget)
		);
		const shouldUsePortalBoundaryAuthState =
			portalContext.kind === "admin" && routePolicy === "portal";
		const authStateToken =
			shouldUsePortalBoundaryAuthState ||
			requiresHostAwareAuthState(portalContext)
				? signPortalAuthState(
						buildPortalAuthStatePayload({
							portalContext,
							redirectTarget: data.redirectTarget,
						}),
						getPortalAuthStateSecret()
					)
				: undefined;

		const authRequest = buildHostAwareAuthRequest({
			authStateToken,
			portalContext,
			redirectTarget: data.redirectTarget,
		});

		if (data.flow === "sign-up") {
			return getSignUpUrl({ data: authRequest });
		}

		return getSignInUrl({ data: authRequest });
	});
