import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(import.meta.dirname, ".env.local") });

const e2ePort = Number(process.env.E2E_PORT ?? 3000);
const e2eBaseUrl = `http://localhost:${e2ePort}`;
const e2eAppBaseUrl = `http://app.localhost:${e2ePort}`;

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL: e2eBaseUrl,
		trace: "on-first-retry",
	},
	webServer: {
		command: `bunx vite dev --host localhost --port ${e2ePort}`,
		env: {
			VELOCITY_E2E_ENABLED: "true",
			WORKOS_REDIRECT_URI: `http://localhost:${e2ePort}/callback`,
			VITE_E2E: "true",
		},
		url: `${e2eBaseUrl}/about`,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
	projects: [
		{
			name: "setup",
			testMatch: "auth.setup.ts",
			testIgnore: ["amps/**", "velocity/**"],
			use: { ...devices["Desktop Chrome"] },
		},
		{
			name: "chromium",
			testDir: "./e2e",
			testIgnore: [
				"amps/**",
				"auth/**",
				"rbac/**",
				"deal-closing/**",
				"document-engine/**",
				"marketplace/**",
				"origination/**",
				"velocity/**",
				"auth.setup.ts",
				"simulation.spec.ts",
			],
			use: { ...devices["Desktop Chrome"] },
		},
		{
			name: "document-engine",
			testDir: "./e2e/document-engine",
			dependencies: ["setup"],
			use: {
				...devices["Desktop Chrome"],
				storageState: ".auth/admin.json",
			},
		},
		{
			name: "simulation",
			testDir: "./e2e",
			testMatch: "simulation.spec.ts",
			dependencies: ["setup"],
			use: {
				...devices["Desktop Chrome"],
				storageState: ".auth/admin.json",
			},
		},
		{
			name: "authenticated",
			testDir: "./e2e/auth",
			dependencies: ["setup"],
			use: {
				...devices["Desktop Chrome"],
				storageState: ".auth/user.json",
			},
		},
		{
			name: "admin",
			testDir: "./e2e/rbac",
			testMatch: "admin.spec.ts",
			dependencies: ["setup"],
			use: {
				...devices["Desktop Chrome"],
				storageState: ".auth/admin.json",
			},
		},
		{
			name: "member",
			testDir: "./e2e/rbac",
			testMatch: "member.spec.ts",
			dependencies: ["setup"],
			use: {
				...devices["Desktop Chrome"],
				storageState: ".auth/member.json",
			},
		},
		{
			name: "deal-closing",
			testDir: "./e2e/deal-closing",
			testIgnore: ["participant-workspaces.spec.ts"],
			dependencies: ["setup"],
			use: {
				...devices["Desktop Chrome"],
				storageState: ".auth/admin.json",
			},
		},
		{
			name: "marketplace-setup",
			testDir: "./e2e/marketplace",
			testMatch: "auth.setup.ts",
			use: {
				...devices["Desktop Chrome"],
			},
		},
		{
			name: "marketplace",
			testDir: "./e2e/marketplace",
			dependencies: ["marketplace-setup"],
			testIgnore: "auth.setup.ts",
			use: {
				...devices["Desktop Chrome"],
				baseURL: e2eAppBaseUrl,
				storageState: ".auth/marketplace-admin.json",
			},
		},
		{
			name: "participant-workspaces",
			testDir: "./e2e/deal-closing",
			testMatch: "participant-workspaces.spec.ts",
			use: { ...devices["Desktop Chrome"] },
		},
		{
			name: "origination",
			testDir: "./e2e/origination",
			dependencies: ["setup"],
			use: {
				...devices["Desktop Chrome"],
				storageState: ".auth/admin.json",
			},
		},
		{
			name: "velocity-setup",
			testDir: "./e2e/velocity",
			testMatch: "auth.setup.ts",
			use: {
				...devices["Desktop Chrome"],
				baseURL: `http://admin.localhost:${e2ePort}`,
			},
		},
		{
			name: "velocity",
			testDir: "./e2e/velocity",
			testIgnore: ["auth.setup.ts"],
			dependencies: ["velocity-setup"],
			workers: 1,
			use: {
				...devices["Desktop Chrome"],
				baseURL: `http://admin.localhost:${e2ePort}`,
				storageState: ".auth/admin.json",
			},
		},
		{
			name: "amps-demo",
			testDir: "./e2e/amps",
			testIgnore: ["auth.setup.ts"],
			dependencies: ["amps-setup"],
			use: {
				...devices["Desktop Chrome"],
				storageState: ".auth/amps-admin.json",
			},
		},
		{
			name: "amps-setup",
			testDir: "./e2e/amps",
			testMatch: "auth.setup.ts",
			use: {
				...devices["Desktop Chrome"],
			},
		},
	],
});
