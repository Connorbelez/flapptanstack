import { test as setup } from "@playwright/test";
import {
	createAuthStorageState,
	TEST_ADMIN_ORG_ID,
	TEST_MEMBER_ORG_ID,
} from "./helpers/auth-storage";
import {
	buildHostAwareSignInHref,
	getAppLocalHost,
} from "./helpers/host-aware-auth";

setup.setTimeout(60_000);

setup("authenticate as user", async ({ page }) => {
	await createAuthStorageState({
		page,
		path: ".auth/user.json",
	});
});

setup("authenticate as admin", async ({ page }) => {
	await createAuthStorageState({
		entryHref: buildHostAwareSignInHref(getAppLocalHost()),
		orgId: TEST_ADMIN_ORG_ID,
		page,
		path: ".auth/admin.json",
	});
});

setup("authenticate as member", async ({ page }) => {
	await createAuthStorageState({
		entryHref: buildHostAwareSignInHref(getAppLocalHost()),
		orgId: TEST_MEMBER_ORG_ID,
		page,
		path: ".auth/member.json",
	});
});

setup("authenticate as app host admin", async ({ page }) => {
	await createAuthStorageState({
		entryHref: buildHostAwareSignInHref(getAppLocalHost()),
		orgId: TEST_ADMIN_ORG_ID,
		page,
		path: ".auth/host-aware-app-admin.json",
	});
});
