import { test as setup } from "@playwright/test";
import {
	createAuthStorageState,
	TEST_ADMIN_ORG_ID,
} from "../helpers/auth-storage";
import {
	buildHostAwareSignInHref,
	getE2EPort,
} from "../helpers/host-aware-auth";

setup.setTimeout(120_000);

setup("authenticate velocity admin", async ({ page }) => {
	const adminHost = `admin.localhost:${getE2EPort()}`;
	await createAuthStorageState({
		entryHref: buildHostAwareSignInHref(adminHost),
		orgId: TEST_ADMIN_ORG_ID,
		page,
		path: ".auth/admin.json",
	});
});
