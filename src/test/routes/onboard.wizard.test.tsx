/**
 * @vitest-environment jsdom
 */

import { useQuery } from "convex/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OnboardingWizard } from "#/routes/onboard/-components/OnboardingWizard";
import { cleanup, render, screen, waitFor } from "./onboard.render";
import { createOnboardingReadModel } from "./onboard.test-helpers";

vi.mock("lucide-react", () => {
	const Icon = () => null;
	return {
		ExternalLink: Icon,
		Globe2: Icon,
		PlayCircle: Icon,
		Save: Icon,
		SendHorizonal: Icon,
		ShieldCheck: Icon,
	};
});

vi.mock("convex/react", () => ({
	useQuery: vi.fn(),
}));

vi.mock("#/components/ui/progress", () => ({
	Progress: ({ value }: { value?: number }) => (
		<div aria-valuenow={value ?? 0} role="progressbar" />
	),
}));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

function mockPortalPreview() {
	vi.mocked(useQuery).mockReturnValue({
		available: true,
		conflictReason: null,
		hosts: {
			localHost: "meridian-capital.localhost:3000",
			productionHost: "meridian-capital.fairlend.ca",
		},
		isReserved: false,
		normalizedSlug: "meridian-capital",
	} as never);
}

describe("onboard wizard save gating", () => {
	it("does not start identity verification after a failed save", async () => {
		mockPortalPreview();
		const saveDraft = vi.fn().mockRejectedValue(new Error("save failed"));
		const startIdentityVerification = vi.fn();

		render(
			<OnboardingWizard
				readModel={createOnboardingReadModel("draft")}
				saveDraft={saveDraft}
				startIdentityVerification={startIdentityVerification}
				submit={vi.fn()}
			/>
		);

		await act(async () => {
			screen
				.getByRole("button", { name: /Start identity verification/i })
				.click();
		});

		await waitFor(() => expect(screen.getByText("save failed")).toBeTruthy());
		expect(startIdentityVerification).not.toHaveBeenCalled();
	});

	it("does not submit after a failed save", async () => {
		mockPortalPreview();
		const saveDraft = vi.fn().mockRejectedValue(new Error("save failed"));
		const submit = vi.fn();

		render(
			<OnboardingWizard
				readModel={createOnboardingReadModel("draft")}
				saveDraft={saveDraft}
				startIdentityVerification={vi.fn()}
				submit={submit}
			/>
		);

		await act(async () => {
			screen.getByRole("button", { name: /Submit for review/i }).click();
		});

		await waitFor(() => expect(screen.getByText("save failed")).toBeTruthy());
		expect(submit).not.toHaveBeenCalled();
	});
});
