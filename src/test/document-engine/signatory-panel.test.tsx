/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render } from "@testing-library/react";
import { Window } from "happy-dom";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignatoryPanel } from "#/components/document-engine/signatory-panel";
import { MORTGAGE_DOCUMENT_SIGNATORY_ROLE_OPTIONS } from "#/lib/document-engine/contracts";
import type { SignatoryConfig } from "#/lib/document-engine/types";

let testWindow: Window | null = null;

const initialSignatories: SignatoryConfig[] = [
	{
		order: 0,
		platformRole: "broker_of_record",
		role: "signatory",
	},
	{
		order: 1,
		platformRole: "lawyer_primary",
		role: "signatory",
	},
];

beforeEach(() => {
	testWindow = new Window({
		url: "http://localhost/admin/document-engine/designer/template_1",
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
	Object.defineProperty(globalThis, "DragEvent", {
		configurable: true,
		value: testWindow.DragEvent,
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

function SignatoryPanelHarness({
	onChange,
}: {
	readonly onChange: (signatories: SignatoryConfig[]) => void;
}) {
	const [signatories, setSignatories] = useState(initialSignatories);

	return (
		<SignatoryPanel
			onChange={(next) => {
				setSignatories(next);
				onChange(next);
			}}
			roleOptions={MORTGAGE_DOCUMENT_SIGNATORY_ROLE_OPTIONS}
			signatories={signatories}
		/>
	);
}

function dataTransfer(sourcePlatformRole: string) {
	const store = new Map<string, string>();
	return {
		dropEffect: "move",
		effectAllowed: "move",
		getData: vi.fn((type: string) => store.get(type) ?? sourcePlatformRole),
		setData: vi.fn((type: string, value: string) => {
			store.set(type, value);
		}),
	};
}

describe("SignatoryPanel", () => {
	it("reorders signatories by dragging the handle and rewrites signing order", () => {
		const onChange = vi.fn();
		const view = render(<SignatoryPanelHarness onChange={onChange} />);
		const transfer = dataTransfer("broker_of_record");

		fireEvent.dragStart(
			view.getByRole("button", {
				name: "Drag Broker of Record to reorder signing order",
			}),
			{ dataTransfer: transfer }
		);
		fireEvent.dragOver(
			view.getByRole("listitem", {
				name: "Primary Lawyer signing order 2",
			}),
			{ dataTransfer: transfer }
		);
		fireEvent.drop(
			view.getByRole("listitem", {
				name: "Primary Lawyer signing order 2",
			}),
			{ dataTransfer: transfer }
		);

		expect(onChange).toHaveBeenCalledWith([
			{
				order: 0,
				platformRole: "lawyer_primary",
				role: "signatory",
			},
			{
				order: 1,
				platformRole: "broker_of_record",
				role: "signatory",
			},
		]);
		expect(
			view.getByRole("listitem", {
				name: "Primary Lawyer signing order 1",
			})
		).toBeTruthy();
		expect(
			view.getByRole("listitem", {
				name: "Broker of Record signing order 2",
			})
		).toBeTruthy();
	});

	it("supports keyboard reordering from the drag handle", () => {
		const onChange = vi.fn();
		const view = render(<SignatoryPanelHarness onChange={onChange} />);

		fireEvent.keyDown(
			view.getByRole("button", {
				name: "Drag Broker of Record to reorder signing order",
			}),
			{ key: "ArrowDown" }
		);

		expect(onChange).toHaveBeenCalledWith([
			{
				order: 0,
				platformRole: "lawyer_primary",
				role: "signatory",
			},
			{
				order: 1,
				platformRole: "broker_of_record",
				role: "signatory",
			},
		]);
	});
});
