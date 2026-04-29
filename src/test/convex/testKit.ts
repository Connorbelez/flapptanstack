import { createRequire } from "node:module";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { convexTest } from "convex-test";
import auditTrailSchema from "../../../convex/components/auditTrail/schema";
import schema from "../../../convex/schema";
import { convexModules } from "../../../convex/test/moduleMaps";
import { loadModulesFromRoot } from "./moduleLoader";
import { registerAuditLogComponent } from "./registerAuditLogComponent";

const require = createRequire(import.meta.url);

const migrationsSchema = (
	await import(
		pathToFileURL(
			`${dirname(require.resolve("@convex-dev/migrations/package.json"))}/dist/component/schema.js`
		).href
	)
).default;
const rateLimiterSchema = (
	await import(
		pathToFileURL(
			`${dirname(require.resolve("@convex-dev/rate-limiter/package.json"))}/dist/component/schema.js`
		).href
	)
).default;
const workflowSchema = (
	await import(
		pathToFileURL(
			`${dirname(require.resolve("@convex-dev/workflow/package.json"))}/dist/component/schema.js`
		).href
	)
).default;
const workpoolSchema = (
	await import(
		pathToFileURL(
			`${dirname(require.resolve("@convex-dev/workpool/package.json"))}/dist/component/schema.js`
		).href
	)
).default;

const auditTrailModules = loadModulesFromRoot(
	new URL("../../../convex/components/auditTrail/", import.meta.url),
	"/convex/components/auditTrail"
);
const migrationsModules = loadModulesFromRoot(
	new URL("../../../node_modules/@convex-dev/migrations/dist/component/", import.meta.url),
	"/node_modules/@convex-dev/migrations/dist/component"
);
const rateLimiterModules = loadModulesFromRoot(
	new URL("../../../node_modules/@convex-dev/rate-limiter/dist/component/", import.meta.url),
	"/node_modules/@convex-dev/rate-limiter/dist/component"
);
const workflowModules = loadModulesFromRoot(
	new URL("../../../node_modules/@convex-dev/workflow/dist/component/", import.meta.url),
	"/node_modules/@convex-dev/workflow/dist/component"
);
const workpoolModules = loadModulesFromRoot(
	new URL("../../../node_modules/@convex-dev/workpool/dist/component/", import.meta.url),
	"/node_modules/@convex-dev/workpool/dist/component"
);

export interface ConvexTestKitOptions {
	includeWorkflowComponents?: boolean;
}

export function createConvexTestKit(options?: ConvexTestKitOptions) {
	const t = convexTest(schema, convexModules);
	registerAuditLogComponent(t, "auditLog");
	t.registerComponent("auditTrail", auditTrailSchema, auditTrailModules);
	t.registerComponent("migrations", migrationsSchema, migrationsModules);
	t.registerComponent("rateLimiter", rateLimiterSchema, rateLimiterModules);

	if (options?.includeWorkflowComponents ?? true) {
		t.registerComponent("workflow", workflowSchema, workflowModules);
		t.registerComponent("workflow/workpool", workpoolSchema, workpoolModules);
	}

	return t;
}
