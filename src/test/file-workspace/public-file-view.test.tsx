/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicFileViewPage } from "#/components/file-workspace/PublicFileViewPage";
import type {
	FileWorkspacePublicLink,
	FileWorkspacePublicNodeList,
} from "#/components/file-workspace/types";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const link: FileWorkspacePublicLink = {
	boxId: "box_public",
	downloadEnabled: false,
	linkId: "link_1",
	linkKind: "public_link",
	principalKind: "public_link",
	rootNodeId: "node_root",
	viewEnabled: true,
};

const nodeList: FileWorkspacePublicNodeList = {
	breadcrumbs: [{ displayName: "Shared files", nodeId: "node_root" }],
	boxId: "box_public",
	linkKind: "public_link",
	nodes: [
		{
			createdAt: 1,
			currentVersion: {
				contentType: "application/pdf",
				scanState: "clean",
				sizeBytes: 4096,
				versionId: "version_clean",
				versionNumber: 1,
			},
			displayName: "Clean package.pdf",
			isRoot: false,
			nodeId: "node_clean",
			nodeType: "file",
			updatedAt: 2,
		},
		{
			createdAt: 1,
			currentVersion: {
				contentType: "application/octet-stream",
				scanState: "rejected",
				sizeBytes: 512,
				versionId: "version_rejected",
				versionNumber: 1,
			},
			displayName: "Blocked file.exe",
			isRoot: false,
			nodeId: "node_blocked",
			nodeType: "file",
			updatedAt: 2,
		},
	],
	parentNodeId: "node_root",
};

describe("PublicFileViewPage", () => {
	it("renders a neutral inaccessible state for expired or revoked links", () => {
		render(<PublicFileViewPage state={{ kind: "inaccessible" }} />);

		expect(screen.getByText("This file share is unavailable")).toBeTruthy();
		expect(screen.queryByText("Blocked file.exe")).toBeNull();
	});

	it("renders view-only files and hides downloads when disabled", () => {
		render(<PublicFileViewPage state={{ kind: "ready", link, nodeList }} />);

		expect(screen.getByText("View only")).toBeTruthy();
		expect(screen.getByText("Downloads off")).toBeTruthy();
		expect(screen.getByText("Clean package.pdf")).toBeTruthy();
		expect(screen.queryByRole("button", { name: /Download Clean/ })).toBeNull();
	});

	it("shows downloads only when link policy enables them and scan permits", () => {
		render(
			<PublicFileViewPage
				state={{
					kind: "ready",
					link: { ...link, downloadEnabled: true },
					nodeList,
				}}
			/>
		);

		expect(
			screen.getByRole("button", { name: "Download Clean package.pdf" })
		).toBeTruthy();
		expect(
			(screen.getByRole("button", {
				name: "Download Blocked file.exe",
			}) as HTMLButtonElement).disabled
		).toBe(true);
	});

	it("renders loading rows without platform navigation text", () => {
		render(<PublicFileViewPage state={{ kind: "loading" }} />);

		expect(screen.getByText("FairLend File Share")).toBeTruthy();
		expect(screen.queryByText("Admin")).toBeNull();
		expect(screen.queryByText("Listings")).toBeNull();
	});
});
