import { getReturnPathname } from "../auth-redirect";
import { buildAbsoluteHostUrl, buildPortalAbsoluteUrl } from "./auth-routing";
import type { PortalAuthStatePayload } from "./auth-state";
import type { RootPortalContext } from "./host-resolution";
import {
	buildViewerPortalLabel,
	requireActiveHomePortal,
	resolvePreferredViewerPortal,
	type ViewerHomePortalAssignment,
} from "./portal-navigation-target";

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
	return buildViewerPortalLabel(portal);
}

function resolveCompletionReturnPath(
	authState: PortalAuthStatePayload,
	portal: {
		defaultPostAuthPath?: string;
	}
) {
	if (authState.hasExplicitReturnPath ?? true) {
		return authState.returnPathname;
	}

	return getReturnPathname(portal.defaultPostAuthPath ?? "/");
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
			const assignedPortal =
				resolvePreferredViewerPortal(viewerAssignment) ??
				requireActiveHomePortal(viewerAssignment);
			const returnPathname = resolveCompletionReturnPath(
				authState,
				assignedPortal
			);

			if (
				currentPortalContext.kind !== "marketing" &&
				currentPortalContext.kind !== "admin"
			) {
				throw new Error(
					"Marketing auth completion must land on a marketing or admin host."
				);
			}

			return {
				kind: "redirect",
				href: buildPortalAbsoluteUrl(
					assignedPortal,
					authState.hostType,
					returnPathname
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
				authState.portalId === viewerAssignment.homePortalId ||
				authState.portalId === viewerAssignment.currentOrgPortalId
			) {
				const returnPathname = resolveCompletionReturnPath(
					authState,
					currentPortalContext.portal
				);
				return {
					kind: "redirect",
					href: buildAbsoluteHostUrl(
						currentPortalContext.canonicalHost,
						returnPathname
					),
				};
			}

			const assignedPortal =
				resolvePreferredViewerPortal(viewerAssignment) ??
				requireActiveHomePortal(viewerAssignment);
			const returnPathname = resolveCompletionReturnPath(
				authState,
				assignedPortal
			);
			const assignedHost =
				authState.hostType === "local"
					? assignedPortal.localHost
					: assignedPortal.productionHost;

			return {
				kind: "wrong-portal",
				continueHref: buildPortalAbsoluteUrl(
					assignedPortal,
					authState.hostType,
					returnPathname
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
