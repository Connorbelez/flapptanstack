import { getAuth, type UserInfo } from "@workos/authkit-tanstack-react-start";
import {
	normalizePermissions,
	normalizeRoles,
	resolvePrimaryRole,
} from "#/lib/auth-policy";
import { resolveRootPortalContext } from "./host-resolution";
import {
	getViewerPortalAssignment,
	type ViewerHomePortalAssignment,
} from "./portal-navigation-target";

export interface RouteHostSessionSnapshot {
	orgId: null | string;
	permissions: string[];
	portalCacheKey: string;
	portalContext: Awaited<ReturnType<typeof resolveRootPortalContext>>;
	requestHost: string;
	role: null | string;
	roles: string[];
	token: null | string;
	userId: null | string;
	viewerPortalAssignment: null | ViewerHomePortalAssignment;
}

export async function resolveRouteHostSession(args: {
	requestHost: string;
}): Promise<RouteHostSessionSnapshot> {
	const auth = await getAuth();
	const { user } = auth;
	if (!user) {
		const portalContext = await resolveRootPortalContext({
			requestHost: args.requestHost,
			token: null,
		});

		return {
			userId: null,
			token: null,
			role: null,
			roles: [],
			permissions: [],
			orgId: null,
			portalCacheKey: portalContext.cacheKey,
			portalContext,
			requestHost: args.requestHost,
			viewerPortalAssignment: null,
		};
	}

	const info = auth as UserInfo;
	const roles = normalizeRoles({ role: info.role, roles: info.roles });
	const token = info.accessToken ?? null;
	const portalContext = await resolveRootPortalContext({
		requestHost: args.requestHost,
		token,
	});

	return {
		userId: user.id,
		token,
		role: resolvePrimaryRole({ role: info.role, roles }),
		roles,
		permissions: normalizePermissions(info.permissions),
		orgId: info.organizationId ?? null,
		portalCacheKey: portalContext.cacheKey,
		portalContext,
		requestHost: args.requestHost,
		viewerPortalAssignment: token
			? await getViewerPortalAssignment(token)
			: null,
	};
}
