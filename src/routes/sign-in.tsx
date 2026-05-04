import { createFileRoute, redirect } from "@tanstack/react-router";
import { sanitizeRedirectPath } from "#/lib/auth-redirect";
import { getHostAwareAuthUrl } from "#/lib/portal/auth-initiation";

export const Route = createFileRoute("/sign-in")({
	validateSearch: (search: Record<string, unknown>) => {
		const invitationToken =
			typeof search.invitationToken === "string"
				? search.invitationToken
				: undefined;
		return {
			...(invitationToken ? { invitationToken } : {}),
			redirect: sanitizeRedirectPath(search.redirect ?? search.redirectTo),
		};
	},
	loaderDeps: ({ search: { invitationToken, redirect } }) => ({
		invitationToken,
		redirect,
	}),
	loader: async ({ deps: { invitationToken, redirect: redirectTarget } }) => {
		const signInUrl = await getHostAwareAuthUrl({
			data: {
				flow: "sign-in",
				invitationToken,
				redirectTarget,
			},
		});
		throw redirect({ href: signInUrl });
	},
});
