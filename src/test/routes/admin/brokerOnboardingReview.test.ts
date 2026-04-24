import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");

function readProjectFile(path: string) {
	return readFileSync(resolve(REPO_ROOT, path), "utf8");
}

describe("broker onboarding review route contract", () => {
	it("registers the protected admin route and navigation entry", () => {
		const routeSource = readProjectFile(
			"src/routes/admin/broker-onboarding/route.tsx"
		);
		const authSource = readProjectFile("src/lib/auth.ts");
		const entityRegistrySource = readProjectFile(
			"src/components/admin/shell/entity-registry.ts"
		);
		const routeTreeSource = readProjectFile("src/routeTree.gen.ts");

		expect(routeSource).toContain('createFileRoute("/admin/broker-onboarding")');
		expect(routeSource).toContain('guardRouteAccess("adminBrokerOnboarding")');
		expect(authSource).toContain("adminBrokerOnboarding");
		expect(authSource).toContain('permission: "onboarding:review"');
		expect(authSource).toContain('"/admin/broker-onboarding"');
		expect(entityRegistrySource).toContain("Broker Onboarding");
		expect(entityRegistrySource).toContain("/admin/broker-onboarding");
		expect(routeTreeSource).toContain("/admin/broker-onboarding");
	});

	it("drives the review workspace from normalized backend projections and review commands", () => {
		const pageSource = readProjectFile(
			"src/components/admin/broker-onboarding/BrokerOnboardingReviewPage.tsx"
		);

		expect(pageSource).toContain("queries.listReviewQueue");
		expect(pageSource).toContain("queries.getReviewDossier");
		expect(pageSource).toContain("mutations.approveForReview");
		expect(pageSource).toContain("mutations.requestChangesForReview");
		expect(pageSource).toContain("mutations.rejectForReview");
		expect(pageSource).toContain("ReviewThread");
		expect(pageSource).toContain("Normalized Evidence");
		expect(pageSource).toContain("Handoff And Activation");
		expect(pageSource).toContain("Require IDV reverification");
		expect(pageSource).toContain("Require regulator reverification");
		expect(pageSource).toContain("Reviewer note");
	});
});
