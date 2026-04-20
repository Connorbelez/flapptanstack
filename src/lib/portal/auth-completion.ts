import { buildAbsoluteHostUrl, buildPortalAbsoluteUrl } from "./auth-routing";
import type { PortalAuthStatePayload } from "./auth-state";
import type { RootPortalContext } from "./host-resolution";

export interface ViewerHomePortalAssignment {
	homePortal: null | {
		defaultPostAuthPath: string;
		isPublished: boolean;
		localHost: string;
		portalId: string;
		portalType: "broker" | "fairlend";
		productionHost: string;
		slug: string;
		status: "active" | "archived" | "draft" | "suspended";
	};
	homePortalId: string | null;
	isFairLendAdmin: boolean;
	userId: string | null;
}

export type AuthCompletionDecision =
	| {
			href: string;
			kind: "redirect";
	  }
	| {
			assignedHost: string;
			assignedPortalLabel: string;
			continueHref: string;
			currentHost: string;
			kind: "wrong-portal";
	  };

function buildPortalLabel(
	portal: NonNullable<ViewerHomePortalAssignment["homePortal"]>
) {
	if (portal.portalType === "fairlend") {
		return "FairLend";
	}

	return portal.slug
		.split("-")
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(" ");
}

function assertActiveHomePortal(
	assignment: ViewerHomePortalAssignment
): NonNullable<ViewerHomePortalAssignment["homePortal"]> {
	if (!(assignment.homePortalId && assignment.homePortal)) {
		throw new Error("Authenticated user is missing a valid home portal.");
	}

	if (
		!assignment.homePortal.isPublished ||
		assignment.homePortal.status !== "active"
	) {
		throw new Error("Authenticated user's assigned portal is unavailable.");
	}

	return assignment.homePortal;
}

export function resolveAuthCompletionDecision(args: {
	authState: PortalAuthStatePayload;
	currentPortalContext: RootPortalContext;
	viewerAssignment: ViewerHomePortalAssignment;
}): AuthCompletionDecision {
	const { authState, currentPortalContext, viewerAssignment } = args;

	if (currentPortalContext.canonicalHost !== authState.canonicalHost) {
		throw new Error(
			"Auth completion host does not match the signed callback host."
		);
	}

	switch (authState.hostClass) {
		case "marketing": {
			const assignedPortal = assertActiveHomePortal(viewerAssignment);

			if (currentPortalContext.kind !== "marketing") {
				throw new Error(
					"Marketing auth completion must land on a marketing host."
				);
			}

			return {
				kind: "redirect",
				href: buildPortalAbsoluteUrl(
					assignedPortal,
					authState.hostType,
					authState.returnPathname
				),
			};
		}
		case "portal": {
			if (
				currentPortalContext.kind !== "portal" ||
				currentPortalContext.availability !== "active"
			) {
				throw new Error(
					"Portal auth completion requires an active portal host."
				);
			}

			if (
				authState.portalId !== String(currentPortalContext.portal.portalId) ||
				authState.portalSlug !== currentPortalContext.portal.slug
			) {
				throw new Error(
					"Portal auth completion does not match the signed portal context."
				);
			}

			if (
				viewerAssignment.isFairLendAdmin ||
				authState.portalId === viewerAssignment.homePortalId
			) {
				return {
					kind: "redirect",
					href: buildAbsoluteHostUrl(
						currentPortalContext.canonicalHost,
						authState.returnPathname
					),
				};
			}

			const assignedPortal = assertActiveHomePortal(viewerAssignment);
			const assignedHost =
				authState.hostType === "local"
					? assignedPortal.localHost
					: assignedPortal.productionHost;

			return {
				kind: "wrong-portal",
				continueHref: buildPortalAbsoluteUrl(
					assignedPortal,
					authState.hostType,
					authState.returnPathname
				),
				currentHost: currentPortalContext.canonicalHost,
				assignedHost,
				assignedPortalLabel: buildPortalLabel(assignedPortal),
			};
		}
		default: {
			const exhaustiveCheck: never = authState.hostClass;
			throw new Error(`Unhandled auth host class: ${String(exhaustiveCheck)}`);
		}
	}
}
