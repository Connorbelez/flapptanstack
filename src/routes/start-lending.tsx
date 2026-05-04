import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	buildLenderHandoffCompletePath,
	normalizeLenderLandingSource,
} from "#/lib/lender-handoff";
import { assertActivePortalId } from "#/lib/portal/active-portal";

export const Route = createFileRoute("/start-lending")({
	validateSearch: (search: Record<string, unknown>) => ({
		listingId:
			typeof search.listingId === "string" && search.listingId.trim()
				? search.listingId.trim()
				: undefined,
		source: normalizeLenderLandingSource(search.source),
	}),
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps, location }) => {
		if (location.pathname !== "/start-lending") {
			return;
		}

		assertActivePortalId(
			context.portalContext,
			"Lender handoff requires an active portal host."
		);

		const completePath = buildLenderHandoffCompletePath(deps);
		if (context.userId) {
			throw redirect({ href: completePath });
		}

		throw redirect({
			search: {
				redirect: completePath,
			},
			to: "/sign-up",
		});
	},
});
