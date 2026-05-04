import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";

export type DealPortalWorkspace = NonNullable<
	FunctionReturnType<typeof api.deals.portalQueries.getDealPortalWorkspace>
>;

export type DealPortalScreen = DealPortalWorkspace["activeScreen"];
export type DealPortalCapability = DealPortalWorkspace["capabilities"][number];
export type DealPortalDocumentInstance =
	DealPortalWorkspace["documents"]["instances"][number];
export type DealPortalPaymentReview = NonNullable<
	DealPortalWorkspace["payment"]["adminReview"]
>;
export type DealPortalPaymentReviewProof =
	DealPortalPaymentReview["proofs"][number];

export function hasPortalCapability(
	workspace: DealPortalWorkspace,
	capability: DealPortalCapability
): boolean {
	return workspace.capabilities.includes(capability);
}
