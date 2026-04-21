import auditLogTest from "convex-audit-log/test";
import { convexTest } from "convex-test";
import auditTrailSchema from "../../../convex/components/auditTrail/schema";
import schema from "../../../convex/schema";
import { convexModules } from "../../../convex/test/moduleMaps";
import migrationsSchema from "../../../node_modules/@convex-dev/migrations/dist/component/schema.js";
import workflowSchema from "../../../node_modules/@convex-dev/workflow/dist/component/schema.js";
import workpoolSchema from "../../../node_modules/@convex-dev/workpool/dist/component/schema.js";

const auditTrailModules = import.meta.glob(
	"../../../convex/components/auditTrail/**/*.ts"
);
const migrationsModules = import.meta.glob(
	"../../../node_modules/@convex-dev/migrations/dist/component/**/*.js"
);
const workflowModules = import.meta.glob(
	"../../../node_modules/@convex-dev/workflow/dist/component/**/*.js"
);
const workpoolModules = import.meta.glob(
	"../../../node_modules/@convex-dev/workpool/dist/component/**/*.js"
);

export interface ConvexTestKitOptions {
	includeWorkflowComponents?: boolean;
}

export function createConvexTestKit(options?: ConvexTestKitOptions) {
	const t = convexTest(schema, convexModules);
	auditLogTest.register(t, "auditLog");
	t.registerComponent("auditTrail", auditTrailSchema, auditTrailModules);
	t.registerComponent("migrations", migrationsSchema, migrationsModules);

	if (options?.includeWorkflowComponents ?? true) {
		t.registerComponent("workflow", workflowSchema, workflowModules);
		t.registerComponent("workflow/workpool", workpoolSchema, workpoolModules);
	}

	return t;
}
