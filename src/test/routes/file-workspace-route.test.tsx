/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fileWorkspaceBoxIndexQueryOptions } from "#/components/file-workspace/query-options";
import { canAccessRoute } from "#/lib/auth";
import { PublicFileViewPage } from "#/components/file-workspace/PublicFileViewPage";
import { FilesIndexRoutePage } from "#/routes/files/index";
import { FilesLayout } from "#/routes/files/route";

vi.mock("@tanstack/react-query", () => ({
	useSuspenseQuery: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual<typeof import("@tanstack/react-router")>(
		"@tanstack/react-router"
	);

	return {
		...actual,
		Outlet: () => <div data-testid="files-route-outlet" />,
	};
});

vi.mock("convex/react", () => ({
	Authenticated: ({ children }: { children: ReactNode }) => (
		<div data-testid="authenticated-files-shell">{children}</div>
	),
	AuthLoading: ({ children }: { children: ReactNode }) => (
		<div data-testid="auth-loading-files-shell">{children}</div>
	),
	useMutation: () => vi.fn(),
}));

vi.mock("#/components/file-workspace/query-options", () => ({
	fileWorkspaceBoxIndexQueryOptions: vi.fn(),
}));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("file workspace routes", () => {
	it("renders an auth-aware files layout before nested suspense screens", () => {
		render(<FilesLayout />);

		expect(screen.getByTestId("authenticated-files-shell")).toBeTruthy();
		expect(screen.getByTestId("auth-loading-files-shell")).toBeTruthy();
		expect(screen.getByTestId("files-route-outlet")).toBeTruthy();
	});

	it("grants files route access to admins and brokers", () => {
		expect(
			canAccessRoute("files", {
				orgId: "org_admin",
				permissions: ["admin:access"],
				role: "admin",
				roles: ["admin"],
			})
		).toBe(true);
		expect(
			canAccessRoute("files", {
				orgId: "org_broker",
				permissions: ["broker:access"],
				role: "broker",
				roles: ["broker"],
			})
		).toBe(true);
		expect(
			canAccessRoute("files", {
				orgId: "org_viewer",
				permissions: [],
				role: "viewer",
				roles: ["viewer"],
			})
		).toBe(false);
	});

	it("loads the box index through the file workspace query helper", () => {
		const queryOptions = { queryKey: ["file-workspace", "boxes"] };
		vi.mocked(fileWorkspaceBoxIndexQueryOptions).mockReturnValue(
			queryOptions as never
		);
		vi.mocked(useSuspenseQuery).mockReturnValue({
			data: [
				{
					boxId: "box_1",
					createdAt: 1,
					name: "Closing docs",
					principalKind: "authenticated",
					role: "manager",
					status: "active",
					updatedAt: 2,
					visibility: "private",
				},
			],
		} as never);

		render(<FilesIndexRoutePage />);

		expect(fileWorkspaceBoxIndexQueryOptions).toHaveBeenCalled();
		expect(useSuspenseQuery).toHaveBeenCalledWith(queryOptions);
		expect(screen.getByText("Files")).toBeTruthy();
		expect(screen.getByText("Closing docs")).toBeTruthy();
	});

	it("renders the public file route without auth wrappers", () => {
		render(<PublicFileViewPage state={{ kind: "loading" }} />);

		expect(screen.getByText("FairLend File Share")).toBeTruthy();
		expect(screen.queryByTestId("authenticated-files-shell")).toBeNull();
		expect(screen.queryByTestId("auth-loading-files-shell")).toBeNull();
	});
});
