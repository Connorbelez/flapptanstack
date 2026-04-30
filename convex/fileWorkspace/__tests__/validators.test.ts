import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import {
	FILE_BOX_STATUSES,
	FILE_BOX_VISIBILITIES,
	FILE_NODE_TYPES,
	FILE_SCAN_STATES,
	FILE_WORKSPACE_PRINCIPAL_KINDS,
	FILE_WORKSPACE_ROLES,
} from "../types";
import {
	assertFileWorkspaceCapability,
	assertFileWorkspaceRole,
	fileWorkspaceContractValues,
	normalizeFileWorkspaceName,
	normalizeFileWorkspaceSiblingKey,
} from "../validators";

describe("File Workspace contracts", () => {
	it("exposes the exact foundational union values", () => {
		expect(FILE_WORKSPACE_ROLES).toEqual(["viewer", "editor", "manager"]);
		expect(FILE_WORKSPACE_PRINCIPAL_KINDS).toEqual([
			"authenticated",
			"public_link",
			"magic_link",
			"platform_admin",
		]);
		expect(FILE_BOX_STATUSES).toEqual([
			"active",
			"archived",
			"suspended",
			"disabled",
		]);
		expect(FILE_BOX_VISIBILITIES).toEqual([
			"private",
			"public_link",
			"magic_link",
			"disabled",
		]);
		expect(FILE_NODE_TYPES).toEqual(["folder", "file"]);
		expect(FILE_SCAN_STATES).toEqual([
			"pending_scan",
			"clean",
			"rejected",
			"scan_error",
			"released_by_admin",
		]);
	});

	it("keeps validator-facing contract values in sync with type constants", () => {
		expect(fileWorkspaceContractValues.roles).toBe(FILE_WORKSPACE_ROLES);
		expect(fileWorkspaceContractValues.principalKinds).toBe(
			FILE_WORKSPACE_PRINCIPAL_KINDS
		);
		expect(fileWorkspaceContractValues.boxStatuses).toBe(FILE_BOX_STATUSES);
		expect(fileWorkspaceContractValues.boxVisibilities).toBe(
			FILE_BOX_VISIBILITIES
		);
		expect(fileWorkspaceContractValues.nodeTypes).toBe(FILE_NODE_TYPES);
		expect(fileWorkspaceContractValues.scanStates).toBe(FILE_SCAN_STATES);
	});

	it("normalizes display names and sibling keys consistently", () => {
		expect(normalizeFileWorkspaceName("  Closing   Docs  ")).toBe(
			"Closing Docs"
		);
		expect(normalizeFileWorkspaceSiblingKey("  Closing   Docs  ")).toBe(
			"closing docs"
		);
	});

	it("rejects empty, path-like, and reserved names", () => {
		for (const name of [
			"",
			"   ",
			".",
			"..",
			"CON",
			"folder/name",
			"bad|name",
		]) {
			expect(() => normalizeFileWorkspaceName(name)).toThrow(ConvexError);
		}
	});

	it("narrows supported role and capability names", () => {
		expect(() => assertFileWorkspaceRole("manager")).not.toThrow();
		expect(() => assertFileWorkspaceCapability("manage_links")).not.toThrow();
		expect(() => assertFileWorkspaceRole("owner")).toThrow(ConvexError);
		expect(() => assertFileWorkspaceCapability("delete_everything")).toThrow(
			ConvexError
		);
	});
});
