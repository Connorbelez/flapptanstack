import {
	FAIRLEND_ADMIN_LOCAL_HOST,
	FAIRLEND_ADMIN_PRODUCTION_HOST,
} from "../../../shared/portal/contracts";
import {
	buildAbsoluteHostUrl,
	resolvePortalHostTypeFromHost,
} from "./auth-routing";

const ADMIN_NAV_PATH = "/admin?detailOpen=false";

export function buildAdminNavigationHref(currentHost: string) {
	const hostType = resolvePortalHostTypeFromHost(currentHost);
	const adminHost =
		hostType === "local"
			? FAIRLEND_ADMIN_LOCAL_HOST
			: FAIRLEND_ADMIN_PRODUCTION_HOST;

	return buildAbsoluteHostUrl(adminHost, ADMIN_NAV_PATH);
}
