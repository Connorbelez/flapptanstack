/**
 * @vitest-environment jsdom
 */

import { useQuery } from "convex/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OnboardingWizard } from "#/routes/onboard/-components/OnboardingWizard";
import { cleanup, fireEvent, render, screen, waitFor } from "./onboard.render";
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

vi.mock("radix-ui", async (importOriginal) => {
	const actual = await importOriginal<typeof import("radix-ui")>();
	return {
		...actual,
		Progress: {
			Indicator: ({ children, ...props }: React.ComponentProps<"div">) => (
				<div {...props}>{children}</div>
			),
			Root: ({
				children,
				value,
				...props
			}: React.ComponentProps<"div"> & { value?: number }) => (
				<div aria-valuenow={value ?? 0} role="progressbar" {...props}>
					{children}
				</div>
			),
		},
	};
});

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

describe("onboard wizard read-model refreshes", () => {
	it("preserves unsaved edits when the same application refreshes", () => {
		mockPortalPreview();
		const readModel = createOnboardingReadModel("draft");
		const { rerender } = render(
			<OnboardingWizard
				readModel={readModel}
				saveDraft={vi.fn()}
				startIdentityVerification={vi.fn()}
				submit={vi.fn()}
			/>
		);

		fireEvent.input(screen.getByDisplayValue("Meridian Capital"), {
			target: { value: "Unsaved Brokerage" },
		});

		rerender(
			<OnboardingWizard
				readModel={createOnboardingReadModel("draft", {
					_id: readModel.application._id,
					draftData: {
						...readModel.application.draftData,
						brokerageName: "Server Refresh Brokerage",
					},
					updatedAt: Date.now(),
				})}
				saveDraft={vi.fn()}
				startIdentityVerification={vi.fn()}
				submit={vi.fn()}
			/>
		);

		expect(screen.getByDisplayValue("Unsaved Brokerage")).toBeTruthy();
		expect(screen.queryByDisplayValue("Server Refresh Brokerage")).toBeNull();
	});
});
