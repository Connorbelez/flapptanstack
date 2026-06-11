/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BorrowerFinancingApplicationPage } from "#/components/borrower/financing/BorrowerFinancingApplicationPage";

afterEach(() => {
	cleanup();
});

describe("borrower financing application continuation", () => {
	it("renders the authenticated intake flow with handoff prefill", () => {
		render(
			<BorrowerFinancingApplicationPage
				kind="intake"
				prefill={{
					amountNeeded: "$650,000",
					email: "alex@example.com",
					fullName: "Alex Borrower",
				}}
			/>
		);

		expect(
			screen.getByRole("heading", { name: "Financing application" })
		).toBeTruthy();
		expect(screen.getByLabelText("Legal name")).toHaveProperty(
			"value",
			"Alex Borrower"
		);
		expect(screen.getByLabelText("Email")).toHaveProperty(
			"value",
			"alex@example.com"
		);
		expect(screen.getByLabelText("Requested amount")).toHaveProperty(
			"value",
			"$650,000"
		);
		expect(
			screen.getByText("Application data collection now happens behind borrower auth.")
		).toBeTruthy();
	});

	it("renders the authenticated pre-approval branch", () => {
		render(
			<BorrowerFinancingApplicationPage kind="pre-approval" prefill={{}} />
		);

		expect(
			screen.getByRole("heading", { name: "Pre-approval application" })
		).toBeTruthy();
		expect(screen.getByLabelText("Property address")).toBeTruthy();
		expect(screen.getByLabelText("Financing notes")).toBeTruthy();
	});

	it("does not expose a native POST submission path for draft saves", () => {
		render(<BorrowerFinancingApplicationPage kind="intake" prefill={{}} />);

		const form = screen
			.getByRole("button", { name: /save application draft/i })
			.closest("form");
		expect(form).toBeTruthy();
		expect(form?.getAttribute("method")).toBeNull();

		const submitEvent = new Event("submit", {
			bubbles: true,
			cancelable: true,
		});
		fireEvent(form as HTMLFormElement, submitEvent);

		expect(submitEvent.defaultPrevented).toBe(true);
	});
});
