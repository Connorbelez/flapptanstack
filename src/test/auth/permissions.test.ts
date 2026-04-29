import {
	PERMISSION_DISPLAY_METADATA,
	hasPermissionGrant,
} from "../../../convex/auth/permissionCatalog";
import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS } from "./permissions";

describe("permission catalog", () => {
	it("grants micinvestor the MIC access permission", () => {
		expect(ROLE_PERMISSIONS.micinvestor).toEqual([
			"mic:access",
			"portfolio:view",
		]);
		expect(
			hasPermissionGrant(ROLE_PERMISSIONS.micinvestor, "mic:access")
		).toBe(true);
		expect(PERMISSION_DISPLAY_METADATA["mic:access"]).toEqual({
			description: "Access the MIC investor portal",
			domain: "access",
			name: "MIC Access",
		});
	});
});
