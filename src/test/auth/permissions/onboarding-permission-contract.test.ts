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
	const reviewPermission = ONBOARDING_PERMISSION_CONTRACT.review.permission;
	const managePermission = ONBOARDING_PERMISSION_CONTRACT.manage.permission;

	it("keeps the runtime onboarding permission split explicit", () => {
		expect(reviewPermission).toBe("onboarding:review");
		expect(managePermission).toBe("onboarding:manage");
		expect(ONBOARDING_PERMISSION_CONTRACT.review.responsibility).toContain(
			"Reviewer decisions"
		);
		expect(ONBOARDING_PERMISSION_CONTRACT.manage.responsibility).toContain(
			"Operational queue"
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
		const contractSection = source.slice(
			source.indexOf("## Onboarding Permission Contract"),
			source.indexOf("## Additional WorkOS Permissions To Provision")
		);
		const workosProvisioningSection = source.slice(
			source.indexOf("## Additional WorkOS Permissions To Provision"),
			source.indexOf("## Runtime Permissions Pending Disposition")
		);
		const pendingDispositionSection = source.slice(
			source.indexOf("## Runtime Permissions Pending Disposition"),
			source.indexOf("## Delivery Sequence")
		);

		expect(source).toContain("## Onboarding Permission Contract");
		expect(contractSection).toContain(`\`${reviewPermission}\``);
		expect(contractSection).toContain(`\`${managePermission}\``);
		expect(workosProvisioningSection).toContain(`\`${reviewPermission}\``);
		expect(workosProvisioningSection).toContain(`\`${managePermission}\``);
		expect(pendingDispositionSection).not.toContain(`\`${managePermission}\``);
	});
});
