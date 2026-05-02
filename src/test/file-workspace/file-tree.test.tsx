/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	FileTree,
	type FileTreeNode,
} from "#/components/file-workspace/FileTree";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const nodes: FileTreeNode[] = [
	{ id: "root", name: "Closing package", type: "folder" },
	{
		id: "conditions",
		name: "Funding conditions",
		parentId: "root",
		type: "folder",
	},
	{
		id: "commitment",
		name: "Commitment letter with a very long descriptive filename.pdf",
		parentId: "conditions",
		type: "file",
	},
	{
		id: "blocked",
		disabled: true,
		name: "Rejected executable.exe",
		parentId: "root",
		type: "file",
	},
	{
		id: "trash",
		name: "Removed disclosure",
		parentId: "root",
		trashed: true,
		type: "file",
	},
];

describe("FileTree", () => {
	it("renders visible tree nodes with selected, disabled, trashed, and drag-target states", () => {
		render(
			<FileTree
				expandedNodeIds={new Set(["root"])}
				nodes={[
					...nodes,
					{
						dragTarget: true,
						id: "uploads",
						name: "Uploads",
						parentId: "root",
						type: "folder",
					},
				]}
				onExpandedChange={vi.fn()}
				onSelect={vi.fn()}
				selectedNodeId="conditions"
			/>
		);

		expect(screen.getByRole("tree", { name: "Files" })).toBeTruthy();
		expect(
			screen
				.getByRole("treeitem", { name: /Funding conditions/ })
				.getAttribute("aria-selected")
		).toBe("true");
		expect(
			screen
				.getByRole("treeitem", { name: /Rejected executable/ })
				.getAttribute("aria-disabled")
		).toBe("true");
		expect(screen.getByText("Removed disclosure")).toBeTruthy();
		expect(
			screen
				.getByText("Uploads")
				.closest('[role="treeitem"]')
				?.classList.contains("border-dashed")
		).toBe(true);
	});

	it("expands and collapses folders from keyboard navigation", () => {
		const onExpandedChange = vi.fn();
		render(
			<FileTree
				expandedNodeIds={new Set(["root"])}
				nodes={nodes}
				onExpandedChange={onExpandedChange}
				onSelect={vi.fn()}
			/>
		);

		const conditions = screen.getByRole("button", {
			name: "Funding conditions",
		});
		conditions.focus();
		fireEvent.keyDown(conditions, { key: "ArrowRight" });

		expect(onExpandedChange).toHaveBeenCalledWith("conditions", true);

		const root = screen.getByRole("button", { name: "Closing package" });
		root.focus();
		fireEvent.keyDown(root, { key: "ArrowLeft" });

		expect(onExpandedChange).toHaveBeenCalledWith("root", false);
	});

	it("moves focus through visible nodes and selects enabled nodes", () => {
		const onSelect = vi.fn();
		render(
			<FileTree
				expandedNodeIds={new Set(["root"])}
				nodes={nodes}
				onExpandedChange={vi.fn()}
				onSelect={onSelect}
			/>
		);

		const root = screen.getByRole("button", { name: "Closing package" });
		root.focus();
		fireEvent.keyDown(root, { key: "ArrowDown" });

		expect(screen.getByRole("button", { name: "Funding conditions" })).toBe(
			document.activeElement
		);

		fireEvent.keyDown(document.activeElement as Element, { key: "Enter" });
		expect(onSelect).toHaveBeenCalledWith("conditions");
	});

	it("does not select disabled nodes", () => {
		const onSelect = vi.fn();
		render(
			<FileTree
				expandedNodeIds={new Set(["root"])}
				nodes={nodes}
				onExpandedChange={vi.fn()}
				onSelect={onSelect}
			/>
		);

		const blocked = screen.getByRole("button", {
			name: "Rejected executable.exe",
		});
		fireEvent.click(blocked);
		fireEvent.keyDown(blocked, { key: "Enter" });

		expect(onSelect).not.toHaveBeenCalled();
	});

	it("renders fixed loading rows", () => {
		render(
			<FileTree
				expandedNodeIds={new Set()}
				loading
				nodes={[]}
				onExpandedChange={vi.fn()}
				onSelect={vi.fn()}
			/>
		);

		expect(screen.getByRole("tree", { name: "Files" }).children).toHaveLength(
			5
		);
	});
});
