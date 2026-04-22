import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ONBOARDING_PERMISSION_CONTRACT } from "../../../../convex/auth/permissionCatalog";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "../../../../");
const RBAC_DOC_PATH = path.join(
	REPO_ROOT,
	"docs/architecture/rbac-and-permissions.md"
);

describe("onboarding permission contract alignment", () => {
	it("keeps the runtime onboarding permission split explicit", () => {
		expect(ONBOARDING_PERMISSION_CONTRACT.review.permission).toBe(
			"onboarding:review"
		);
		expect(ONBOARDING_PERMISSION_CONTRACT.manage.permission).toBe(
			"onboarding:manage"
		);
		expect(ONBOARDING_PERMISSION_CONTRACT.review.runtimeConsumers).toContain(
			"convex/onboarding/mutations.ts"
		);
		expect(ONBOARDING_PERMISSION_CONTRACT.manage.runtimeConsumers).toContain(
			"convex/onboarding/queries.ts"
		);
	});

	it("documents review and manage as distinct onboarding permissions", async () => {
		const source = await readFile(RBAC_DOC_PATH, "utf8");

		expect(source).toContain("## Onboarding Permission Contract");
		expect(source).toMatch(
			/`onboarding:review`[\s\S]*reviewer-decision permission/i
		);
		expect(source).toMatch(
			/`onboarding:manage`[\s\S]*operational permission/i
		);
		expect(source).toMatch(
			/Additional WorkOS Permissions To Provision[\s\S]*`onboarding:review`/i
		);
		expect(source).toMatch(
			/Additional WorkOS Permissions To Provision[\s\S]*`onboarding:manage`/i
		);
		expect(source).not.toMatch(
			/Runtime Permissions Pending Disposition[\s\S]*`onboarding:manage`/i
		);
	});
});
