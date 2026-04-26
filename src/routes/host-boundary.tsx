import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { HostAccessBoundaryState } from "#/components/portal/HostAccessBoundaryState";
import {
	getReturnOnlyPathname,
	sanitizeRedirectPath,
} from "#/lib/auth-redirect";
import { portalRequestMiddleware } from "#/lib/portal/request-host";
import { resolveRouteHostDecision } from "#/lib/portal/route-host-decision";
import { resolveRouteHostSession } from "#/lib/portal/route-host-session";

function sanitizeBoundaryReturnTo(input: unknown) {
	const returnTo = sanitizeRedirectPath(input) ?? "/";
	return returnTo === "/host-boundary" ? "/" : returnTo;
}

const resolveHostBoundary = createServerFn({ method: "GET" })
	.middleware([portalRequestMiddleware])
	.inputValidator((input: { returnTo: string }) => input)
	.handler(async ({ context, data }) => {
		const session = await resolveRouteHostSession({
			requestHost: context.requestHost,
		});
		const decision = resolveRouteHostDecision({
			pathname: getReturnOnlyPathname(data.returnTo),
			portalContext: session.portalContext,
			returnTo: data.returnTo,
			userId: session.userId,
			viewerPortalAssignment: session.viewerPortalAssignment,
		});

		if (decision.kind === "allow") {
			return {
				href: data.returnTo,
				kind: "redirect" as const,
			};
		}

		return decision;
	});

export const Route = createFileRoute("/host-boundary")({
	validateSearch: (search: Record<string, unknown>) => ({
		returnTo: sanitizeBoundaryReturnTo(search.returnTo),
	}),
	loaderDeps: ({ search }) => ({
		returnTo: search.returnTo,
	}),
	loader: async ({ deps }) => {
		const decision = await resolveHostBoundary({
			data: { returnTo: deps.returnTo },
		});

		if (decision.kind === "redirect") {
			throw redirect({ href: decision.href });
		}

		return decision;
	},
	component: HostBoundaryRoute,
});

function HostBoundaryRoute() {
	const decision = Route.useLoaderData();

	return <HostAccessBoundaryState {...decision} />;
}
