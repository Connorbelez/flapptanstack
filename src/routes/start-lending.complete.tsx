import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getAuth } from "@workos/authkit-tanstack-react-start";
import { ConvexHttpClient } from "convex/browser";
import {
	buildLenderHandoffCompletePath,
	buildLenderHandoffStartPath,
	LENDER_HANDOFF_POST_AUTH_PATH,
	normalizeLenderLandingSource,
} from "#/lib/lender-handoff";
import { assertActivePortalId } from "#/lib/portal/active-portal";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const completeLandingStart = createServerFn({ method: "POST" })
	.inputValidator(
		(input: {
			entryPath: string;
			listingId?: string | undefined;
			portalId: Id<"portals">;
		}) => input
	)
	.handler(async ({ data }) => {
		const auth = await getAuth();
		if (!(auth.user && "accessToken" in auth && auth.accessToken)) {
			throw new Error("Lender handoff completion requires authentication.");
		}

		const convexUrl = import.meta.env.VITE_CONVEX_URL;
		if (!convexUrl) {
			throw new Error("missing VITE_CONVEX_URL env var");
		}

		const client = new ConvexHttpClient(convexUrl);
		client.setAuth(auth.accessToken);
		return await client.mutation(
			api.onboarding.lenderLanding.completeLandingStart,
			data
		);
	});

export const Route = createFileRoute("/start-lending/complete")({
	validateSearch: (search: Record<string, unknown>) => ({
		listingId:
			typeof search.listingId === "string" && search.listingId.trim()
				? search.listingId.trim()
				: undefined,
		source: normalizeLenderLandingSource(search.source),
	}),
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		const portalId = assertActivePortalId(
			context.portalContext,
			"Lender handoff completion requires an active portal host."
		);

		if (!context.userId) {
			throw redirect({
				search: {
					redirect: buildLenderHandoffCompletePath(deps),
				},
				to: "/sign-up",
			});
		}

		await completeLandingStart({
			data: {
				entryPath: buildLenderHandoffStartPath(deps),
				listingId: deps.listingId,
				portalId,
			},
		});

		throw redirect({ to: LENDER_HANDOFF_POST_AUTH_PATH });
	},
});
