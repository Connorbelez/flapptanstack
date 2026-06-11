import { describe, expect, it } from "vitest";
import playwrightConfig from "../../playwright.config";
import { isVelocityE2eRuntimeAllowed } from "../../convex/test/velocityE2e";

describe("Velocity E2E hardening", () => {
	it("keeps the shared auth setup project scoped to the root E2E auth setup file", () => {
		const setupProject = playwrightConfig.projects?.find(
			(project) => project.name === "setup"
		);

		expect(setupProject?.testMatch).toBeInstanceOf(RegExp);
		const testMatch = setupProject?.testMatch as RegExp;
		expect(testMatch.test("/repo/e2e/auth.setup.ts")).toBe(true);
		expect(testMatch.test("/repo/e2e/velocity/auth.setup.ts")).toBe(false);
		expect(testMatch.test("/repo/e2e/marketplace/auth.setup.ts")).toBe(false);
	});

	it("allows Velocity failure mutation helpers only in explicit test environments", () => {
		expect(
			isVelocityE2eRuntimeAllowed({
				ALLOW_TEST_AUTH_ENDPOINTS: "true",
				NODE_ENV: "test",
				VELOCITY_E2E_ENABLED: "true",
			})
		).toBe(true);
		expect(
			isVelocityE2eRuntimeAllowed({
				ALLOW_TEST_AUTH_ENDPOINTS: "true",
				NODE_ENV: "development",
				VELOCITY_E2E_ENABLED: "true",
			})
		).toBe(true);
		expect(
			isVelocityE2eRuntimeAllowed({
				ALLOW_TEST_AUTH_ENDPOINTS: "true",
				NODE_ENV: "production",
				VELOCITY_E2E_ENABLED: "true",
			})
		).toBe(false);
		expect(
			isVelocityE2eRuntimeAllowed({
				NODE_ENV: "test",
				VELOCITY_E2E_ENABLED: "true",
			})
		).toBe(false);
	});
});
