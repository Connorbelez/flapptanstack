/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewThreadComposer } from "#/routes/onboard/-components/ReviewThreadComposer";
import { cleanup, fireEvent, render, screen, waitFor } from "./onboard.render";
import { createOnboardingReadModel } from "./onboard.test-helpers";

vi.mock("lucide-react", () => {
	const Icon = () => null;
	return { MessageSquarePlus: Icon };
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("onboard broker notes", () => {
	it("appends broker notes into the review thread contract", async () => {
		const appendBrokerNote = vi.fn().mockResolvedValue(undefined);

		render(
			<ReviewThreadComposer
				appendBrokerNote={appendBrokerNote}
				readModel={createOnboardingReadModel("submitted")}
			/>
		);

		fireEvent.change(screen.getByPlaceholderText("Add context for the reviewer"), {
			target: { value: "Updated license document is ready." },
		});
		fireEvent.click(screen.getByRole("button", { name: "Add note" }));

		await waitFor(() =>
			expect(appendBrokerNote).toHaveBeenCalledWith({
				applicationId: "application_1",
				body: "Updated license document is ready.",
			})
		);
	});

	it("does not expose mutable CRM note actions", () => {
		render(
			<ReviewThreadComposer
				appendBrokerNote={vi.fn()}
				readModel={createOnboardingReadModel("submitted")}
			/>
		);

		expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
		expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
	});
});
