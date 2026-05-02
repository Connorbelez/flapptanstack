/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BoxIndexPage } from "#/components/file-workspace/BoxIndexPage";
import { WorkspacePage } from "#/components/file-workspace/WorkspacePage";
import type {
	FileWorkspaceBoxDetail,
	FileWorkspaceBoxIndexItem,
	FileWorkspaceCapabilities,
	FileWorkspaceManagerSettings,
	FileWorkspaceNodeList,
} from "#/components/file-workspace/types";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const boxes: FileWorkspaceBoxIndexItem[] = [
	{
		boxId: "box_manager",
		createdAt: 1,
		description: "Manager-owned closing package",
		name: "Closing docs",
		principalKind: "authenticated",
		role: "manager",
		status: "active",
		updatedAt: 1_800_000_000_000,
		visibility: "private",
	},
	{
		boxId: "box_public",
		createdAt: 1,
		name: "Shared diligence",
		principalKind: "authenticated",
		role: "viewer",
		status: "archived",
		updatedAt: 1_800_000_100_000,
		visibility: "public_link",
	},
];

const boxDetail: FileWorkspaceBoxDetail = {
	archivedAt: undefined,
	boxId: "box_manager",
	createdAt: 1,
	createdByAuthId: "auth_1",
	description: "Manager-owned closing package",
	name: "Closing docs",
	principalKind: "authenticated",
	role: "manager",
	rootNodeId: "node_root",
	status: "active",
	updatedAt: 1_800_000_000_000,
	visibility: "private",
};

const nodeList: FileWorkspaceNodeList = {
	breadcrumbs: [
		{
			displayName: "Closing docs",
			nodeId: "node_root",
		},
	],
	boxId: "box_manager",
	nodes: [
		{
			createdAt: 1,
			currentVersion: null,
			displayName: "Funding conditions",
			isRoot: false,
			nodeId: "node_folder",
			nodeType: "folder",
			updatedAt: 1_800_000_000_000,
		},
		{
			createdAt: 1,
			currentVersion: {
				contentType: "application/pdf",
				scanState: "pending_scan",
				sizeBytes: 2048,
				versionId: "version_1",
				versionNumber: 1,
			},
			displayName: "Commitment letter.pdf",
			isRoot: false,
			nodeId: "node_file",
			nodeType: "file",
			updatedAt: 1_800_000_000_000,
		},
	],
	parentNodeId: "node_root",
	principalKind: "authenticated",
};

const capabilities = new Set<FileWorkspaceCapabilities["capabilities"][number]>([
	"list_nodes",
	"preview_clean_file",
	"upload_file",
	"create_folder",
	"manage_links",
	"view_trash",
	"view_comments",
	"view_versions",
]);

const managerSettings: FileWorkspaceManagerSettings = {
	box: {
		archivedAt: undefined,
		boxId: "box_manager",
		description: "Manager-owned closing package",
		downloadPolicy: {
			authenticated: true,
			magicLink: false,
			publicLink: false,
		},
		name: "Closing docs",
		retentionPolicy: {
			allowEditorRestore: true,
			allowManagerPermanentDeleteRequest: true,
			trashRetentionDays: 90,
		},
		scanPolicy: {
			allowArchives: false,
			allowManualScanErrorRelease: true,
			blockedExtensions: [".exe"],
			maxArchiveCompressionRatio: 10,
			maxArchiveDepth: 2,
			maxArchiveEntries: 100,
			maxArchiveExpandedBytes: 10_000,
			maxArchiveSizeBytes: 10_000,
		},
		status: "active",
		storageLimits: {
			maxBoxBytes: 100_000,
			maxFileBytes: 25_000,
		},
		updatedAt: 1_800_000_000_000,
		visibility: "private",
	},
	links: [],
	participants: [
		{
			acceptedAt: undefined,
			authId: "auth_1",
			createdAt: 1,
			email: "manager@example.com",
			invitedAt: undefined,
			participantId: "participant_1",
			participantKey: "auth:auth_1",
			revokedAt: undefined,
			role: "manager",
			status: "active",
			updatedAt: 1,
			userId: undefined,
		},
	],
	principalKind: "authenticated",
};

describe("authenticated file workspace UI", () => {
	it("filters boxes and exposes the create-box action", () => {
		const onCreateBox = vi.fn();
		render(
			<BoxIndexPage
				activeFilter="public"
				boxes={boxes}
				onCreateBox={onCreateBox}
			/>
		);

		expect(screen.getByText("Shared diligence")).toBeTruthy();
		expect(screen.queryByText("Closing docs")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: /Create box/ }));
		expect(onCreateBox).toHaveBeenCalled();
	});

	it("renders workspace panes, capability-based actions, and explicit scan state", () => {
		const onUpload = vi.fn();
		render(
			<WorkspacePage
				box={boxDetail}
				capabilities={capabilities}
				expandedNodeIds={new Set(["node_root"])}
				managerSettings={managerSettings}
				nodeList={nodeList}
				onUpload={onUpload}
				selectedNodeId="node_file"
				viewMode="table"
			/>
		);

		expect(screen.getAllByText("Funding conditions").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Pending Scan").length).toBeGreaterThan(0);
		expect(screen.getByText("Participants")).toBeTruthy();
		expect(screen.getByText("Inspector")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Upload" }));
		expect(onUpload).toHaveBeenCalled();
	});

	it("disables mutation controls when capabilities are absent", () => {
		render(
			<WorkspacePage
				box={boxDetail}
				capabilities={new Set(["list_nodes"])}
				expandedNodeIds={new Set(["node_root"])}
				nodeList={nodeList}
				viewMode="table"
			/>
		);

		expect(
			(screen.getByRole("button", { name: "Upload" }) as HTMLButtonElement)
				.disabled
		).toBe(true);
	});
});
