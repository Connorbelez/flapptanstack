import { ConvexHttpClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";

export type ViewerHomePortalAssignment = FunctionReturnType<
	typeof api.portals.queries.getViewerHomePortal
>;

export type ViewerPortalSummary = NonNullable<
	ViewerHomePortalAssignment["homePortal"]
>;

function createAuthedConvexClient(token: string) {
	const convexUrl = import.meta.env.VITE_CONVEX_URL;
	if (!convexUrl) {
		throw new Error("missing VITE_CONVEX_URL env var");
	}

	const client = new ConvexHttpClient(convexUrl);
	client.setAuth(token);
	return client;
}

export async function getViewerPortalAssignment(token: string) {
	return (await createAuthedConvexClient(token).query(
		api.portals.queries.getViewerHomePortal,
		{}
	)) as ViewerHomePortalAssignment;
}

export function isActiveViewerPortal(
	portal:
		| null
		| undefined
		| ViewerHomePortalAssignment["currentOrgPortal"]
		| ViewerHomePortalAssignment["homePortal"]
): portal is ViewerPortalSummary {
	return Boolean(portal?.isPublished && portal.status === "active");
}

export function requireActiveHomePortal(
	assignment: ViewerHomePortalAssignment
): ViewerPortalSummary {
	if (
		!(assignment.homePortalId && isActiveViewerPortal(assignment.homePortal))
	) {
		throw new Error("Authenticated user is missing a valid home portal.");
	}

	return assignment.homePortal;
}

export function resolvePreferredViewerPortal(
	assignment: ViewerHomePortalAssignment
) {
	if (isActiveViewerPortal(assignment.currentOrgPortal)) {
		return assignment.currentOrgPortal;
	}

	if (isActiveViewerPortal(assignment.homePortal)) {
		return assignment.homePortal;
	}

	return null;
}

export function matchesViewerPortalAssignment(args: {
	assignment: ViewerHomePortalAssignment;
	portalId: string;
}) {
	return (
		args.assignment.isFairLendAdmin ||
		args.assignment.currentOrgPortalId === args.portalId ||
		args.assignment.homePortalId === args.portalId
	);
}

export function buildViewerPortalLabel(portal: ViewerPortalSummary) {
	if (portal.portalType === "fairlend") {
		return "FairLend";
	}

	return portal.slug
		.split("-")
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(" ");
}
