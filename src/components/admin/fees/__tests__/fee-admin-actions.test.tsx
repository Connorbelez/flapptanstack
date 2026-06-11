// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { BulkApplyFeeSetPanel } from "../bulk-apply-fee-set-panel";
import { FeeSetForm } from "../fee-set-form";
import { MortgageFeeApplicationPanel } from "../mortgage-fee-application-panel";

const PREVIEW_UNAVAILABLE_NAME = /preview unavailable/i;
const SAVE_SET_UNAVAILABLE_NAME = /save set unavailable/i;
const INSPECT_UNAVAILABLE_NAME = /inspect unavailable/i;

class TestResizeObserver {
	disconnect() {}
	observe() {}
	unobserve() {}
}

describe("admin fee action affordances", () => {
	beforeAll(() => {
		globalThis.ResizeObserver = TestResizeObserver;
	});

	it("marks bulk fee-set preview as unavailable instead of rendering a dead action", () => {
		render(<BulkApplyFeeSetPanel />);

		const button = screen.getByRole("button", {
			name: PREVIEW_UNAVAILABLE_NAME,
		});
		expect((button as HTMLButtonElement).disabled).toBe(true);
		expect(button.getAttribute("title")).toBe(
			"Preview unavailable: bulk fee-set preview is not supported yet"
		);
	});

	it("marks fee-set save as unavailable instead of rendering a dead action", () => {
		render(<FeeSetForm />);

		const button = screen.getByRole("button", {
			name: SAVE_SET_UNAVAILABLE_NAME,
		});
		expect((button as HTMLButtonElement).disabled).toBe(true);
		expect(button.getAttribute("title")).toBe(
			"Save set unavailable: fee-set persistence is not supported yet"
		);
	});

	it("marks mortgage fee inspection as unavailable instead of rendering a dead action", () => {
		render(<MortgageFeeApplicationPanel />);

		const button = screen.getByRole("button", {
			name: INSPECT_UNAVAILABLE_NAME,
		});
		expect((button as HTMLButtonElement).disabled).toBe(true);
		expect(button.getAttribute("title")).toBe(
			"Inspect unavailable: mortgage fee inspection is not supported yet"
		);
	});
});
