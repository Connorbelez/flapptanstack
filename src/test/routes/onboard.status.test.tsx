/**
 * @vitest-environment jsdom
 */

import { useQuery } from "convex/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OnboardingCorrections } from "#/routes/onboard/-components/OnboardingCorrections";
import { OnboardingStatusPage } from "#/routes/onboard/-components/OnboardingStatusPage";
import { PortalTeaserCard } from "#/routes/onboard/-components/PortalTeaserCard";
import { cleanup, render, screen } from "./onboard.render";
import { createOnboardingReadModel } from "./onboard.test-helpers";

vi.mock("lucide-react", () => {
	const Icon = () => null;
	return {
		AlertTriangle: Icon,
		CheckCircle2: Icon,
		Clock3: Icon,
		ExternalLink: Icon,
		Globe2: Icon,
		MessageSquarePlus: Icon,
		RotateCcw: Icon,
		ShieldCheck: Icon,
		XCircle: Icon,
	};
});

vi.mock("convex/react", () => ({
	useQuery: vi.fn(),
}));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

function mockPortalPreview(available: boolean, conflictReason: string | null = null) {
	vi.mocked(useQuery).mockReturnValue({
		available,
		conflictReason,
		hosts: {
			localHost: "meridian-capital.localhost:3000",
			productionHost: "meridian-capital.fairlend.ca",
		},
		isReserved: conflictReason === "reserved",
		normalizedSlug: "meridian-capital",
	} as never);
}

describe("onboard status surfaces", () => {
	it("renders submitted details and reviewer expectations", () => {
		mockPortalPreview(true);
		render(
			<OnboardingStatusPage
				appendBrokerNote={vi.fn()}
				readModel={createOnboardingReadModel("submitted")}
			/>
		);

		expect(screen.getByText("Your application is with FairLend review.")).toBeTruthy();
		expect(screen.getByText("Submitted details")).toBeTruthy();
		expect(screen.getByText("Meridian Capital")).toBeTruthy();
	});

	it("renders changes-requested as a focused correction surface", () => {
		mockPortalPreview(true);
		render(
			<OnboardingCorrections
				appendBrokerNote={vi.fn()}
				readModel={createOnboardingReadModel("changes_requested")}
				saveDraft={vi.fn()}
				submit={vi.fn()}
			/>
		);

		expect(screen.getByText("Update only the fields FairLend reopened.")).toBeTruthy();
		expect(screen.getByText("Reviewer note")).toBeTruthy();
		expect(screen.getByLabelText("License number")).toBeTruthy();
		expect(screen.getByText(/Reverification is required for License number/)).toBeTruthy();
	});

	it("distinguishes approved provisioning from activated", () => {
		mockPortalPreview(true);
		const { rerender } = render(
			<OnboardingStatusPage
				appendBrokerNote={vi.fn()}
				readModel={createOnboardingReadModel("approved")}
			/>
		);

		expect(screen.getByText("Approved. Provisioning is still in flight.")).toBeTruthy();
		expect(screen.getByText(/Approval is not the final activation state/)).toBeTruthy();

		rerender(
			<OnboardingStatusPage
				appendBrokerNote={vi.fn()}
				readModel={createOnboardingReadModel("activated")}
			/>
		);

		expect(screen.getByText("Your broker portal is active.")).toBeTruthy();
	});

	it("shows shared-contract slug preview and availability feedback", () => {
		mockPortalPreview(false, "reserved");

		render(
			<PortalTeaserCard
				application={createOnboardingReadModel("draft").application}
			/>
		);

		expect(screen.getByText("Reserved word")).toBeTruthy();
		expect(screen.getByText("meridian-capital.fairlend.ca")).toBeTruthy();
		expect(screen.getByText(/does not claim a namespace/)).toBeTruthy();
	});
});
