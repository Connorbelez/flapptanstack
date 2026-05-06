import { describe, expect, it } from "vitest";
import {
	defaultFileWorkspaceScanPolicy,
	isFileWorkspaceScanStateVisible,
	validateFileWorkspaceBoxQuota,
	validateFileWorkspaceContentType,
	validateFileWorkspaceExtension,
	validateFileWorkspaceFileSize,
} from "../policy";

describe("File Workspace policy", () => {
	it("allows only clean and released versions to become visible", () => {
		expect(isFileWorkspaceScanStateVisible("pending_scan")).toBe(false);
		expect(isFileWorkspaceScanStateVisible("rejected")).toBe(false);
		expect(isFileWorkspaceScanStateVisible("scan_error")).toBe(false);
		expect(isFileWorkspaceScanStateVisible("clean")).toBe(true);
		expect(isFileWorkspaceScanStateVisible("released_by_admin")).toBe(true);
	});

	it("blocks executable, script, installer, and active HTML extensions", () => {
		for (const displayName of [
			"installer.exe",
			"script.js",
			"run.sh",
			"payload.msi",
			"active.html",
		]) {
			const result = validateFileWorkspaceExtension({
				displayName,
				policy: defaultFileWorkspaceScanPolicy,
			});
			expect(result).toMatchObject({
				allowed: false,
				reasonCode: "blocked_extension",
			});
		}
	});

	it("keeps archive uploads disabled by default", () => {
		const result = validateFileWorkspaceExtension({
			displayName: "loan-package.zip",
			policy: defaultFileWorkspaceScanPolicy,
		});
		expect(result).toMatchObject({
			allowed: false,
			reasonCode: "archives_disabled",
		});
	});

	it("does not treat OpenXML documents as generic archives", () => {
		const result = validateFileWorkspaceExtension({
			contentType:
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			displayName: "commitment.docx",
			policy: defaultFileWorkspaceScanPolicy,
		});
		expect(result).toEqual({
			allowed: true,
			normalizedExtension: ".docx",
		});
	});

	it("normalizes MIME parameters before allowlist checks", () => {
		expect(
			validateFileWorkspaceContentType({
				contentType: " Text/Plain; charset=utf-8 ",
				policy: defaultFileWorkspaceScanPolicy,
			})
		).toEqual({
			allowed: true,
			normalizedExtension: undefined,
		});
	});

	it("enforces per-file size and box quota limits", () => {
		expect(
			validateFileWorkspaceFileSize({
				policy: defaultFileWorkspaceScanPolicy,
				sizeBytes: defaultFileWorkspaceScanPolicy.maxFileSizeBytes + 1,
			})
		).toMatchObject({ allowed: false, reasonCode: "file_too_large" });

		expect(
			validateFileWorkspaceBoxQuota({
				currentBoxBytes: 900,
				incomingSizeBytes: 101,
				storageLimits: { maxBoxBytes: 1000 },
			})
		).toMatchObject({ allowed: false, reasonCode: "box_quota_exceeded" });
	});
});
