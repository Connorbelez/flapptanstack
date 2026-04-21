import {
	FAIRLEND_ADMIN_LOCAL_HOST,
	FAIRLEND_ADMIN_PRODUCTION_HOST,
	FAIRLEND_MARKETING_LOCAL_HOST,
	FAIRLEND_MARKETING_PRODUCTION_HOST,
	FAIRLEND_PORTAL_LOCAL_HOST,
	FAIRLEND_PORTAL_PRODUCTION_HOST,
} from "../../../shared/portal/contracts";
import { getReturnPathname } from "../auth-redirect";
import {
	buildAbsoluteHostUrl,
	buildPortalAbsoluteUrl,
	resolvePortalHostTypeFromHost,
} from "./auth-routing";
import type { RootPortalContext } from "./host-resolution";
import {
	buildViewerPortalLabel,
	matchesViewerPortalAssignment,
	resolvePreferredViewerPortal,
	type ViewerHomePortalAssignment,
} from "./portal-navigation-target";
import {
	type RouteHostPolicyKind,
	resolveRouteHostPolicy,
} from "./route-host-policy";

export type RouteHostBoundaryKind =
	| "marketing-required"
	| "portal-required"
	| "admin-required"
	| "wrong-portal"
	| "missing-portal-assignment";

export type RouteHostDecision =
	| { kind: "allow" }
	| { href: string; kind: "redirect" }
	| {
			boundaryKind: RouteHostBoundaryKind;
			continueHref?: string;
			continueLabel?: string;
			currentHost: string;
			expectedHost?: string;
			kind: "boundary";
			returnTo: string;
	  };

function buildSignInHref(currentHost: string, returnTo: string) {
	const signInUrl = new URL(buildAbsoluteHostUrl(currentHost, "/sign-in"));
	signInUrl.searchParams.set("redirect", returnTo);
	return signInUrl.toString();
}

function buildMarketingHost(hostType: "local" | "production") {
	return hostType === "local"
		? FAIRLEND_MARKETING_LOCAL_HOST
		: FAIRLEND_MARKETING_PRODUCTION_HOST;
}

function buildAdminHost(hostType: "local" | "production") {
	return hostType === "local"
		? FAIRLEND_ADMIN_LOCAL_HOST
		: FAIRLEND_ADMIN_PRODUCTION_HOST;
}

function buildFairLendPortalHost(hostType: "local" | "production") {
	return hostType === "local"
		? FAIRLEND_PORTAL_LOCAL_HOST
		: FAIRLEND_PORTAL_PRODUCTION_HOST;
}

function buildPortalRequiredBoundary(args: {
	currentHost: string;
	hostType: "local" | "production";
	returnTo: string;
	viewerPortalAssignment: null | ViewerHomePortalAssignment;
}) {
	const preferredPortal = args.viewerPortalAssignment
		? resolvePreferredViewerPortal(args.viewerPortalAssignment)
		: null;
	if (preferredPortal) {
		const expectedHost =
			args.hostType === "local"
				? preferredPortal.localHost
				: preferredPortal.productionHost;
		return {
			kind: "boundary" as const,
			boundaryKind: "portal-required" as const,
			currentHost: args.currentHost,
			expectedHost,
			continueHref: buildPortalAbsoluteUrl(
				preferredPortal,
				args.hostType,
				args.returnTo
			),
			continueLabel: `Continue to ${buildViewerPortalLabel(preferredPortal)}`,
			returnTo: args.returnTo,
		};
	}

	if (args.viewerPortalAssignment?.isFairLendAdmin) {
		const expectedHost = buildFairLendPortalHost(args.hostType);
		return {
			kind: "boundary" as const,
			boundaryKind: "portal-required" as const,
			currentHost: args.currentHost,
			expectedHost,
			continueHref: buildAbsoluteHostUrl(expectedHost, args.returnTo),
			continueLabel: "Continue to FairLend portal",
			returnTo: args.returnTo,
		};
	}

	if (args.viewerPortalAssignment) {
		return {
			kind: "boundary" as const,
			boundaryKind: "missing-portal-assignment" as const,
			currentHost: args.currentHost,
			returnTo: args.returnTo,
		};
	}

	return {
		kind: "boundary" as const,
		boundaryKind: "portal-required" as const,
		currentHost: args.currentHost,
		continueHref: buildSignInHref(args.currentHost, args.returnTo),
		continueLabel: "Sign in to continue",
		returnTo: args.returnTo,
	};
}

function resolvePolicyBoundary(args: {
	currentHost: string;
	hostType: "local" | "production";
	policy: Exclude<RouteHostPolicyKind, "shared" | "portal">;
	returnTo: string;
}) {
	if (args.policy === "marketing") {
		const expectedHost = buildMarketingHost(args.hostType);
		return {
			kind: "boundary" as const,
			boundaryKind: "marketing-required" as const,
			currentHost: args.currentHost,
			expectedHost,
			continueHref: buildAbsoluteHostUrl(expectedHost, args.returnTo),
			continueLabel: "Continue to FairLend marketing",
			returnTo: args.returnTo,
		};
	}

	const expectedHost = buildAdminHost(args.hostType);
	return {
		kind: "boundary" as const,
		boundaryKind: "admin-required" as const,
		currentHost: args.currentHost,
		expectedHost,
		continueHref: buildAbsoluteHostUrl(expectedHost, args.returnTo),
		continueLabel: "Continue to FairLend admin",
		returnTo: args.returnTo,
	};
}

export function resolveRouteHostDecision(args: {
	pathname: string;
	portalContext: RootPortalContext;
	returnTo?: string;
	userId: null | string;
	viewerPortalAssignment: null | ViewerHomePortalAssignment;
}): RouteHostDecision {
	const policy = resolveRouteHostPolicy(args.pathname);
	if (!policy || policy === "shared") {
		return { kind: "allow" } satisfies RouteHostDecision;
	}

	const currentHost = args.portalContext.canonicalHost;
	const hostType = resolvePortalHostTypeFromHost(currentHost);
	const returnTo = getReturnPathname(args.returnTo ?? args.pathname);

	if (policy === "marketing") {
		return args.portalContext.kind === "marketing"
			? ({ kind: "allow" } satisfies RouteHostDecision)
			: resolvePolicyBoundary({
					currentHost,
					hostType,
					policy,
					returnTo,
				});
	}

	if (policy === "admin") {
		return args.portalContext.kind === "admin"
			? ({ kind: "allow" } satisfies RouteHostDecision)
			: resolvePolicyBoundary({
					currentHost,
					hostType,
					policy,
					returnTo,
				});
	}

	if (
		args.portalContext.kind === "portal" &&
		args.portalContext.availability === "active"
	) {
		if (!(args.userId && args.viewerPortalAssignment)) {
			return { kind: "allow" } satisfies RouteHostDecision;
		}

		if (
			matchesViewerPortalAssignment({
				assignment: args.viewerPortalAssignment,
				portalId: String(args.portalContext.portal.portalId),
			})
		) {
			return { kind: "allow" } satisfies RouteHostDecision;
		}

		const preferredPortal = resolvePreferredViewerPortal(
			args.viewerPortalAssignment
		);
		if (!preferredPortal) {
			return {
				kind: "boundary",
				boundaryKind: "missing-portal-assignment",
				currentHost,
				returnTo,
			} satisfies RouteHostDecision;
		}

		const expectedHost =
			hostType === "local"
				? preferredPortal.localHost
				: preferredPortal.productionHost;
		return {
			kind: "boundary",
			boundaryKind: "wrong-portal",
			currentHost,
			expectedHost,
			continueHref: buildPortalAbsoluteUrl(preferredPortal, hostType, returnTo),
			continueLabel: `Continue to ${buildViewerPortalLabel(preferredPortal)}`,
			returnTo,
		} satisfies RouteHostDecision;
	}

	return buildPortalRequiredBoundary({
		currentHost,
		hostType,
		returnTo,
		viewerPortalAssignment:
			args.userId && args.viewerPortalAssignment
				? args.viewerPortalAssignment
				: null,
	});
}
