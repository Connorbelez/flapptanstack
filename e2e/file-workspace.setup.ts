import { test as setup } from "@playwright/test";
import { createAuthStorageState } from "./helpers/auth-storage";
import { FILE_WORKSPACE_E2E_STORAGE_STATE } from "./helpers/file-workspace";
import {
	buildHostAwareSignInHref,
	getAppLocalHost,
} from "./helpers/host-aware-auth";

setup("authenticate for file workspace", async ({ page }) => {
	await createAuthStorageState({
		entryHref: buildHostAwareSignInHref(getAppLocalHost()),
		page,
		path: FILE_WORKSPACE_E2E_STORAGE_STATE,
	});
});
