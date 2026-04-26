import type { Id } from "../../../convex/_generated/dataModel";
import type { RootPortalContext } from "./host-resolution";

export function assertActivePortalId(
	portalContext: RootPortalContext,
	message = "An active portal host is required for this route."
): Id<"portals"> {
	if (
		portalContext.kind !== "portal" ||
		portalContext.availability !== "active"
	) {
		throw new Error(message);
	}

	return portalContext.portal.portalId;
}
