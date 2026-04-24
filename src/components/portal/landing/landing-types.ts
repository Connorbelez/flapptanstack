import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";

export type PublicPortalLandingPageContract = NonNullable<
	FunctionReturnType<typeof api.portals.queries.getPublicPortalLandingPage>
>;

export type PublicPortalLandingAction =
	PublicPortalLandingPageContract["hero"]["primaryAction"];

export type PublicPortalLandingListing =
	PublicPortalLandingPageContract["featuredListings"]["items"][number];
