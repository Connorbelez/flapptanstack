import { test as setup } from "@playwright/test";
import {
	createAuthStorageState,
	TEST_ADMIN_ORG_ID,
} from "../helpers/auth-storage";
import {
	buildHostAwareSignInHref,
	getAppLocalHost,
} from "../helpers/host-aware-auth";

setup.setTimeout(120_000);

setup("authenticate as marketplace app host admin", async ({ page }) => {
	await createAuthStorageState({
		entryHref: buildHostAwareSignInHref(getAppLocalHost()),
		expectedRole: "admin",
		orgId: TEST_ADMIN_ORG_ID,
		page,
		path: ".auth/marketplace-admin.json",
	});
});
