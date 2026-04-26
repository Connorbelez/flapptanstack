import { createRequire } from "node:module";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import type { GenericSchema, SchemaDefinition } from "convex/server";
import type { TestConvex } from "convex-test";
import { loadModulesFromRoot } from "./moduleLoader";

const require = createRequire(import.meta.url);

const aggregateSchema = (
	await import(
		pathToFileURL(
			`${dirname(require.resolve("@convex-dev/aggregate/package.json"))}/dist/component/schema.js`
		).href
	)
).default;
const auditLogSchema = (
	await import(
		pathToFileURL(
			`${dirname(require.resolve("convex-audit-log/package.json"))}/dist/component/schema.js`
		).href
	)
).default;

function loadAuditLogModules() {
	return loadModulesFromRoot(
		new URL(
			"../../../node_modules/convex-audit-log/dist/component/",
			import.meta.url
		),
		"/node_modules/convex-audit-log/dist/component"
	);
}

function loadAggregateModules() {
	return loadModulesFromRoot(
		new URL(
			"../../../node_modules/@convex-dev/aggregate/dist/component/",
			import.meta.url
		),
		"/node_modules/@convex-dev/aggregate/dist/component"
	);
}

export function registerAuditLogComponent(
	t: TestConvex<SchemaDefinition<GenericSchema, boolean>>,
	name = "auditLog"
) {
	t.registerComponent(name, auditLogSchema, loadAuditLogModules());
	t.registerComponent(
		`${name}/aggregateBySeverity`,
		aggregateSchema,
		loadAggregateModules()
	);
	t.registerComponent(
		`${name}/aggregateByAction`,
		aggregateSchema,
		loadAggregateModules()
	);
}
