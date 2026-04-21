import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getAuth } from "@workos/authkit-tanstack-react-start";
import { WrongPortalState } from "#/components/portal/WrongPortalState";
import { resolveAuthCompletionDecision } from "#/lib/portal/auth-completion";
import {
	getPortalAuthStateSecret,
	verifyPortalAuthState,
} from "#/lib/portal/auth-state";
import { resolveRootPortalContext } from "#/lib/portal/host-resolution";
import { getViewerPortalAssignment } from "#/lib/portal/portal-navigation-target";
import { portalRequestMiddleware } from "#/lib/portal/request-host";

const resolveAuthCompletion = createServerFn({ method: "GET" })
	.middleware([portalRequestMiddleware])
	.inputValidator((input: { authStateToken: string }) => input)
	.handler(async ({ context, data }) => {
		if (!data.authStateToken) {
			throw new Error("Missing auth state token.");
		}

		const auth = await getAuth();
		if (!(auth.user && "accessToken" in auth && auth.accessToken)) {
			throw new Error(
				"Auth completion requires an authenticated WorkOS session."
			);
		}

		const currentPortalContext = await resolveRootPortalContext({
			requestHost: context.requestHost,
			token: auth.accessToken,
		});
		const authState = verifyPortalAuthState(
			data.authStateToken,
			getPortalAuthStateSecret()
		);
		const viewerAssignment = await getViewerPortalAssignment(auth.accessToken);

		return resolveAuthCompletionDecision({
			authState,
			currentPortalContext,
			viewerAssignment,
		});
	});

export const Route = createFileRoute("/auth-complete")({
	validateSearch: (search: Record<string, unknown>) => ({
		authState:
			typeof search.authState === "string" ? search.authState : undefined,
	}),
	loaderDeps: ({ search }) => ({ authState: search.authState }),
	loader: async ({ deps }) => {
		const result = await resolveAuthCompletion({
			data: {
				authStateToken: deps.authState ?? "",
			},
		});

		if (result.kind === "redirect") {
			throw redirect({ href: result.href });
		}

		return result;
	},
	component: AuthCompleteRoute,
});

function AuthCompleteRoute() {
	const decision = Route.useLoaderData();
	return <WrongPortalState {...decision} />;
}
