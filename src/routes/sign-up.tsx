import { createFileRoute, redirect } from "@tanstack/react-router";
import { sanitizeRedirectPath } from "#/lib/auth-redirect";
import { getHostAwareAuthUrl } from "#/lib/portal/auth-initiation";

export const Route = createFileRoute("/sign-up")({
	validateSearch: (search: Record<string, unknown>) => ({
		redirect: sanitizeRedirectPath(search.redirect ?? search.redirectTo),
	}),
	loaderDeps: ({ search: { redirect } }) => ({ redirect }),
	loader: async ({ deps: { redirect: redirectTarget } }) => {
		const signUpUrl = await getHostAwareAuthUrl({
			data: {
				flow: "sign-up",
				redirectTarget,
			},
		});
		throw redirect({ href: signUpUrl });
	},
});
