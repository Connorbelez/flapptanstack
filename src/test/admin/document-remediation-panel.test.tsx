/**
 * @vitest-environment jsdom
 */

import {
	cleanup,
	fireEvent,
	render,
	waitFor,
} from "@testing-library/react";
import { useAction, useMutation } from "convex/react";
import { getFunctionName } from "convex/server";
import { Window } from "happy-dom";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import {
	DocumentRemediationPanel,
	type DocumentRemediationPanelDocument,
} from "#/components/admin/deals/DocumentRemediationPanel";
import { toast } from "sonner";

interface MockHook {
	mockImplementation(value: (...args: unknown[]) => unknown): MockHook;
	mockReturnValueOnce(value: unknown): MockHook;
}

let testWindow: Window | null = null;

vi.mock("convex/react", () => ({
	useAction: vi.fn(),
	useMutation: vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}));

vi.mock("#/components/ui/dialog", () => ({
	Dialog: ({
		children,
		open,
	}: {
		children: ReactNode;
		open?: boolean;
	}) => (open ? <div role="dialog">{children}</div> : null),
	DialogContent: ({ children }: { children: ReactNode }) => (
		<div>{children}</div>
	),
	DialogDescription: ({ children }: { children: ReactNode }) => (
		<p>{children}</p>
	),
	DialogFooter: ({ children }: { children: ReactNode }) => (
		<div>{children}</div>
	),
	DialogHeader: ({ children }: { children: ReactNode }) => (
		<div>{children}</div>
	),
	DialogTitle: ({ children }: { children: ReactNode }) => (
		<h2>{children}</h2>
	),
}));

vi.mock("@tanstack/react-router", () => ({
	Link: (props: {
		children: ReactNode;
		className?: string;
		params?: Record<string, string>;
		to: string;
	}) => {
		const href = props.to
			.replace("$recordid", props.params?.recordid ?? "$recordid")
			.replace("$templateId", props.params?.templateId ?? "$templateId");

		return (
			<a className={props.className} href={href}>
				{props.children}
			</a>
		);
	},
}));

beforeEach(() => {
	testWindow = new Window({
		url: "http://localhost/admin/deals/deal_1",
	});
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: testWindow,
	});
	Object.defineProperty(globalThis, "document", {
		configurable: true,
		value: testWindow.document,
	});
	Object.defineProperty(globalThis, "navigator", {
		configurable: true,
		value: testWindow.navigator,
	});
	Object.defineProperty(globalThis, "HTMLElement", {
		configurable: true,
		value: testWindow.HTMLElement,
	});
	Object.defineProperty(globalThis, "Element", {
		configurable: true,
		value: testWindow.Element,
	});
	Object.defineProperty(globalThis, "Node", {
		configurable: true,
		value: testWindow.Node,
	});
	Object.defineProperty(globalThis, "MutationObserver", {
		configurable: true,
		value: testWindow.MutationObserver,
	});
	Object.defineProperty(globalThis, "PointerEvent", {
		configurable: true,
		value: testWindow.PointerEvent,
	});
	Object.defineProperty(globalThis, "Event", {
		configurable: true,
		value: testWindow.Event,
	});
	Object.defineProperty(globalThis, "InputEvent", {
		configurable: true,
		value: testWindow.InputEvent,
	});
	Object.defineProperty(globalThis, "MouseEvent", {
		configurable: true,
		value: testWindow.MouseEvent,
	});
	Object.defineProperty(globalThis, "HTMLFormElement", {
		configurable: true,
		value: testWindow.HTMLFormElement,
	});
	Object.defineProperty(globalThis, "HTMLTextAreaElement", {
		configurable: true,
		value: testWindow.HTMLTextAreaElement,
	});
	Object.defineProperty(testWindow, "SyntaxError", {
		configurable: true,
		value: SyntaxError,
	});
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	void testWindow?.happyDOM.abort();
	testWindow = null;
});

function buildDocument(
	overrides: Partial<DocumentRemediationPanelDocument> = {}
): DocumentRemediationPanelDocument {
	return {
		displayName: "Borrower signing packet",
		instanceId: "instance_1" as Id<"dealDocumentInstances">,
		lastError:
			"Documenso validation failed: signer recipients must have at least one signature field",
		mortgageId: "mortgage_1" as Id<"mortgages">,
		remediation: {
			actions: [
				{
					action: "open_authoring",
					copy: "Open the template authoring surface and fix the signature field or provider setup.",
				},
				{
					action: "retry_instance",
					copy: "Retry this failed row after correcting the deal-scoped configuration.",
				},
				{
					action: "refresh_snapshot",
					copy: "Replace this failed row from the latest active source blueprint snapshot.",
				},
				{
					action: "waive_for_deal",
					copy: "Archive this failed row as intentionally waived for this deal.",
				},
				{
					action: "archive_source_blueprint",
					copy: "Archive the source blueprint so future deal packages do not generate it.",
				},
			],
			eligibility: "remediable_failed_instance",
			primaryAction: "open_authoring",
			summary:
				"Documenso requires at least one signer signature field. Fix the template authoring before retrying.",
		},
		remediationAction: null,
		remediationReason: null,
		sourceBlueprintId:
			"source_blueprint_1" as Id<"mortgageDocumentBlueprints">,
		status: "provider_error",
		supersededByInstanceId: null,
		templateId: "template_1" as Id<"documentTemplates">,
		...overrides,
	};
}

function convexFunctionName(reference: unknown) {
	return getFunctionName(reference as Parameters<typeof getFunctionName>[0]);
}

function mockConvexHooks() {
	const retryDealDocumentInstance = vi.fn().mockResolvedValue(null);
	const refreshDealDocumentInstanceSnapshot = vi.fn().mockResolvedValue(null);
	const waiveDealDocumentInstance = vi.fn().mockResolvedValue(null);
	const archiveSourceBlueprintForFutureDeals = vi.fn().mockResolvedValue(null);

	(useAction as unknown as MockHook).mockImplementation((reference) => {
		if (
			convexFunctionName(reference) ===
			"documents/dealPackages:refreshDealDocumentInstanceSnapshot"
		) {
			return refreshDealDocumentInstanceSnapshot;
		}
		return retryDealDocumentInstance;
	});
	(useMutation as unknown as MockHook).mockImplementation((reference) => {
		if (
			convexFunctionName(reference) ===
			"documents/dealPackages:archiveSourceBlueprintForFutureDeals"
		) {
			return archiveSourceBlueprintForFutureDeals;
		}
		return waiveDealDocumentInstance;
	});

	return {
		archiveSourceBlueprintForFutureDeals,
		refreshDealDocumentInstanceSnapshot,
		retryDealDocumentInstance,
		waiveDealDocumentInstance,
	};
}

describe("DocumentRemediationPanel", () => {
	it("renders signer-field remediation controls and runs row actions", async () => {
		const hooks = mockConvexHooks();
		const view = render(<DocumentRemediationPanel document={buildDocument()} />);

		expect(
			view.getByText(
				"Documenso requires at least one signer signature field. Fix the template authoring before retrying."
			)
		).toBeTruthy();
		expect(
			view.getByRole("link", { name: /Open template/ }).getAttribute("href")
		).toBe("/admin/document-engine/designer/template_1");

		fireEvent.click(view.getByRole("button", { name: /Retry document/ }));
		await waitFor(() => {
			expect(hooks.retryDealDocumentInstance).toHaveBeenCalledWith({
				instanceId: "instance_1",
			});
		});
		await waitFor(() => {
			expect(
				view.getByRole("button", { name: /Retry document/ }).hasAttribute("disabled")
			).toBe(false);
		});

		fireEvent.click(view.getByRole("button", { name: /Update snapshot/ }));
		await waitFor(() => {
			expect(hooks.refreshDealDocumentInstanceSnapshot).toHaveBeenCalledWith({
				instanceId: "instance_1",
			});
		});
		await waitFor(() => {
			expect(
				view
					.getByRole("button", { name: /Update snapshot/ })
					.hasAttribute("disabled")
			).toBe(false);
		});

		fireEvent.pointerDown(
			view.getByRole("button", { name: /Remove from this deal/ })
		);
		fireEvent.click(view.getByRole("button", { name: /Remove from this deal/ }));
		await waitFor(() => {
			expect(
				view.getByText("Why is this document waived for this deal?")
			).toBeTruthy();
		});
		const waiveForm = view.getByRole("dialog").querySelector("form");
		expect(waiveForm).toBeTruthy();
		fireEvent.submit(waiveForm as HTMLFormElement);
		expect(
			view.getByText("Enter at least 3 characters before waiving.")
		).toBeTruthy();
		const waiveReasonInput = view.getByLabelText("Waiver reason");
		fireEvent.input(waiveReasonInput, {
			target: { value: "Borrower package is not required for this deal." },
		});
		await waitFor(() => {
			expect((waiveReasonInput as HTMLTextAreaElement).value).toBe(
				"Borrower package is not required for this deal."
			);
		});
		fireEvent.submit(waiveForm as HTMLFormElement);
		await waitFor(() => {
			expect(hooks.waiveDealDocumentInstance).toHaveBeenCalledWith({
				instanceId: "instance_1",
				reason: "Borrower package is not required for this deal.",
			});
		});
		expect(toast.success).toHaveBeenCalledWith(
			"Intentionally waived for this deal"
		);

		fireEvent.click(
			view.getByRole("button", {
				name: /Archive source blueprint for future deals/,
			})
		);
		await waitFor(() => {
			expect(hooks.archiveSourceBlueprintForFutureDeals).toHaveBeenCalledWith({
				instanceId: "instance_1",
				sourceBlueprintId: "source_blueprint_1",
			});
		});
	});

	it("links missing mapping remediation to the mortgage mapping surface", () => {
		mockConvexHooks();
		const view = render(
			<DocumentRemediationPanel
				document={buildDocument({
					remediation: {
						actions: [
							{
								action: "open_mapping",
								copy: "Open document mapping and fix the variable or recipient mapping for this deal.",
							},
							{
								action: "retry_instance",
								copy: "Retry this failed row after correcting the deal-scoped configuration.",
							},
						],
						eligibility: "remediable_failed_instance",
						primaryAction: "open_mapping",
						summary:
							"The document is missing recipient mapping for one or more signatories.",
					},
				})}
			/>
		);

		expect(
			view.getByText(
				"The document is missing recipient mapping for one or more signatories."
			)
		).toBeTruthy();
		expect(
			view.getByRole("link", { name: /Review mapping/ }).getAttribute("href")
		).toBe("/admin/mortgages/mortgage_1");
	});

	it("renders waived remediation state without primary actions", () => {
		mockConvexHooks();
		const view = render(
			<DocumentRemediationPanel
				document={buildDocument({
					remediation: {
						actions: [],
						eligibility: "already_remediated",
						primaryAction: null,
						summary: "This document row has already been remediated.",
					},
					remediationAction: "waived_for_deal",
					remediationReason: "Deal parties confirmed this document is unnecessary.",
					supersededByInstanceId:
						"instance_replacement" as Id<"dealDocumentInstances">,
				})}
			/>
		);

		expect(view.getByText("Intentionally waived for this deal")).toBeTruthy();
		expect(
			view.getByText(
				"Reason: Deal parties confirmed this document is unnecessary."
			)
		).toBeTruthy();
		expect(view.getByText("Replacement: instance_replacement")).toBeTruthy();
		expect(view.queryByRole("button", { name: /Retry document/ })).toBeNull();
		expect(view.queryByRole("link", { name: /Open template/ })).toBeNull();
	});
});
