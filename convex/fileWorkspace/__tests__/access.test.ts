import { describe, expect, it } from "vitest";
import {
	allowFileWorkspaceAccess,
	assertFileWorkspaceCapability,
	canFileWorkspace,
	capabilitiesForLinkPrincipal,
	capabilitiesForPlatformAdmin,
	capabilitiesForRole,
	denyFileWorkspaceAccess,
	principalForLink,
	resolvePrincipalFromViewer,
} from "../access";
import { createFileWorkspaceActivityForPrincipal } from "../activity";
import {
	actorFromPrincipal,
	createFileWorkspaceSecurityEvent,
	FILE_WORKSPACE_SAFE_ERRORS,
} from "../securityEvents";

describe("File Workspace access contracts", () => {
	it("models viewer, editor, and manager capabilities", () => {
		const viewer = capabilitiesForRole("viewer");
		expect(canFileWorkspace(viewer, "list_nodes")).toBe(true);
		expect(canFileWorkspace(viewer, "preview_clean_file")).toBe(true);
		expect(canFileWorkspace(viewer, "upload_file")).toBe(false);
		expect(canFileWorkspace(viewer, "manage_links")).toBe(false);

		const editor = capabilitiesForRole("editor");
		expect(canFileWorkspace(editor, "upload_file")).toBe(true);
		expect(canFileWorkspace(editor, "soft_delete_node")).toBe(true);
		expect(canFileWorkspace(editor, "manage_participants")).toBe(false);

		const manager = capabilitiesForRole("manager");
		expect(canFileWorkspace(manager, "manage_box_settings")).toBe(true);
		expect(canFileWorkspace(manager, "manage_participants")).toBe(true);
		expect(canFileWorkspace(manager, "request_permanent_delete")).toBe(true);
	});

	it("keeps bearer link visitors view-only with download as an explicit policy", () => {
		const noDownload = capabilitiesForLinkPrincipal();
		expect(canFileWorkspace(noDownload, "list_nodes")).toBe(true);
		expect(canFileWorkspace(noDownload, "preview_clean_file")).toBe(true);
		expect(canFileWorkspace(noDownload, "download_file")).toBe(false);
		expect(canFileWorkspace(noDownload, "comment_on_file")).toBe(false);
		expect(canFileWorkspace(noDownload, "view_security_events")).toBe(false);

		const withDownload = capabilitiesForLinkPrincipal({
			downloadsAllowed: true,
		});
		expect(canFileWorkspace(withDownload, "download_file")).toBe(true);
	});

	it("grants platform admins oversight without requiring participant role", () => {
		const principal = resolvePrincipalFromViewer({
			viewer: {
				authId: "user_admin",
				email: "admin@test.fairlend.ca",
				isFairLendAdmin: true,
			},
		});
		expect(principal).toEqual({
			authId: "user_admin",
			email: "admin@test.fairlend.ca",
			kind: "platform_admin",
		});
		expect(
			canFileWorkspace(capabilitiesForPlatformAdmin(), "manage_links")
		).toBe(true);
	});

	it("fails closed for non-participants who are not platform admins", () => {
		const principal = resolvePrincipalFromViewer({
			viewer: {
				authId: "user_non_participant",
				email: "non-participant@test.fairlend.ca",
				isFairLendAdmin: false,
			},
		});
		expect(principal).toBeNull();

		const linkPrincipal = principalForLink({
			linkId: "link_123",
			linkKind: "public_link",
		});
		const denied = denyFileWorkspaceAccess({ principal: linkPrincipal });
		expect(denied.allowed).toBe(false);
		expect(denied.errorMessage).toBe(FILE_WORKSPACE_SAFE_ERRORS.ACCESS_DENIED);
	});

	it("builds activity and security envelopes from principals", () => {
		const principal = principalForLink({
			linkId: "link_123",
			linkKind: "magic_link",
		});
		const actor = actorFromPrincipal(principal);
		expect(actor).toEqual({ principalKind: "magic_link" });

		const access = allowFileWorkspaceAccess({
			options: { downloadsAllowed: true },
			principal,
		});
		expect(access.allowed).toBe(true);
		expect(canFileWorkspace(access.capabilities, "download_file")).toBe(true);

		const activity = createFileWorkspaceActivityForPrincipal(principal, {
			boxId: "box_123",
			createdAt: 1,
			eventType: "file_uploaded",
			nodeId: "node_123",
			targetId: "version_123",
			targetType: "version",
		});
		expect(activity.actor.principalKind).toBe("magic_link");

		const security = createFileWorkspaceSecurityEvent({
			actor,
			boxId: "box_123",
			createdAt: 2,
			eventType: "preview_requested",
			nodeId: "node_123",
			outcome: "allowed",
		});
		expect(security).toMatchObject({
			actor,
			eventType: "preview_requested",
			outcome: "allowed",
		});
	});

	it("asserts capabilities through the central permission decision point", () => {
		const principal = principalForLink({
			linkId: "link_123",
			linkKind: "public_link",
		});

		expect(() =>
			assertFileWorkspaceCapability({
				capability: "preview_clean_file",
				principal,
			})
		).not.toThrow();
		expect(() =>
			assertFileWorkspaceCapability({
				capability: "comment_on_file",
				principal,
			})
		).toThrow(FILE_WORKSPACE_SAFE_ERRORS.ACCESS_DENIED);
	});
});
