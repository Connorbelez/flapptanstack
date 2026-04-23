import aggregateSchema from "../../../node_modules/@convex-dev/aggregate/dist/component/schema.js";
import auditLogSchema from "../../../node_modules/convex-audit-log/dist/component/schema.js";
import type { GenericSchema, SchemaDefinition } from "convex/server";
import type { TestConvex } from "convex-test";
import { loadModulesFromRoot } from "./moduleLoader";

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
