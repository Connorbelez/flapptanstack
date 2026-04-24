/**
 * @vitest-environment jsdom
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	BrokerOnboardingReviewWorkspace,
	resolveBrokerOnboardingReviewSelection,
} from "#/components/admin/broker-onboarding/BrokerOnboardingReviewPage";
import type { Id } from "../../../../convex/_generated/dataModel";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const APPLICATION_ID =
	"broker_onboarding_application_review_1" as Id<"brokerOnboardingApplications">;
type WorkspaceProps = Parameters<typeof BrokerOnboardingReviewWorkspace>[0];

function readProjectFile(path: string) {
	return readFileSync(resolve(REPO_ROOT, path), "utf8");
}

function createActions(
	overrides: Partial<WorkspaceProps["actions"]> = {}
): WorkspaceProps["actions"] {
	return {
		approve: vi.fn().mockResolvedValue({ ok: true }),
		reject: vi.fn().mockResolvedValue({ ok: true }),
		requestChanges: vi.fn().mockResolvedValue({ ok: true }),
		...overrides,
	};
}

function createQueueItem(overrides: Record<string, unknown> = {}) {
	return {
		applicationId: APPLICATION_ID,
		changesRequestedAt: null,
		downstreamHandoffStatus: "not_started",
		draftSummary: {
			brokerageName: "North Star Review Brokerage",
			brokerageNumber: "BR-001",
			licenseNumber: "ON-123",
			licenseProvince: "ON",
			requestedPortalSlug: "north-star",
			selfReportedName: {
				firstName: "Avery",
				lastName: "Broker",
			},
		},
		freshness: "fresh",
		identityVerificationStatus: "verified",
		latestReviewEntry: null,
		reasonCodes: [],
		regulatorStatus: "active",
		requiresReverification: false,
		status: "submitted",
		submittedAt: Date.parse("2026-04-20T12:00:00.000Z"),
		updatedAt: Date.parse("2026-04-21T12:00:00.000Z"),
		verificationRecommendation: "review_needed",
		verifiedEmail: "avery@example.test",
		...overrides,
	};
}

function createDossier(overrides: Record<string, unknown> = {}) {
	const queueItem = createQueueItem();
	return {
		application: {
			_id: APPLICATION_ID,
			downstreamHandoffStatus: "not_started",
			draftData: queueItem.draftSummary,
			reopenedFields: [],
			status: queueItem.status,
			verificationState: {
				requiresReverification: false,
				reverificationFieldPaths: [],
			},
		},
		auditHistory: [],
		downstreamOnboardingRequest: null,
		queueItem,
		reviewEntries: [],
		...overrides,
	};
}

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("broker onboarding review route contract", () => {
	it("registers the protected admin route and navigation entry", () => {
		const routeSource = readProjectFile(
			"src/routes/admin/broker-onboarding/route.tsx"
		);
		const authSource = readProjectFile("src/lib/auth.ts");
		const entityRegistrySource = readProjectFile(
			"src/components/admin/shell/entity-registry.ts"
		);
		const routeTreeSource = readProjectFile("src/routeTree.gen.ts");

		expect(routeSource).toContain('createFileRoute("/admin/broker-onboarding")');
		expect(routeSource).toContain('guardRouteAccess("adminBrokerOnboarding")');
		expect(authSource).toContain("adminBrokerOnboarding");
		expect(authSource).toContain('permission: "onboarding:review"');
		expect(authSource).toContain('"/admin/broker-onboarding"');
		expect(entityRegistrySource).toContain("Broker Onboarding");
		expect(entityRegistrySource).toContain("/admin/broker-onboarding");
		expect(routeTreeSource).toContain("/admin/broker-onboarding");
	});

	it("renders missing verification evidence as unavailable", async () => {
		render(
			React.createElement(BrokerOnboardingReviewWorkspace, {
				actions: createActions(),
				dossier: createDossier(),
				onSelectedIdChange: vi.fn(),
				onViewChange: vi.fn(),
				queue: [createQueueItem()],
				selectedId: APPLICATION_ID,
				view: "submitted",
			})
		);

		await screen.findByText("Normalized Evidence");
		expect(screen.getByText("Fraud signal").nextSibling?.textContent).toBe(
			"Not available"
		);
	});

	it("clears the selected dossier when the active queue becomes empty", () => {
		expect(
			resolveBrokerOnboardingReviewSelection(APPLICATION_ID, [])
		).toBeNull();
	});

	it("renders the empty queue without a stale dossier selection", async () => {
		let queue = [createQueueItem()];
		const actions = createActions();
		const { rerender } = render(
			React.createElement(BrokerOnboardingReviewWorkspace, {
				actions,
				dossier: createDossier(),
				onSelectedIdChange: vi.fn(),
				onViewChange: vi.fn(),
				queue,
				selectedId: APPLICATION_ID,
				view: "submitted",
			})
		);
		await screen.findByText("North Star Review Brokerage");

		queue = [];
		rerender(
			React.createElement(BrokerOnboardingReviewWorkspace, {
				actions,
				dossier: createDossier(),
				onSelectedIdChange: vi.fn(),
				onViewChange: vi.fn(),
				queue,
				selectedId: null,
				view: "submitted",
			})
		);

		await waitFor(() => {
			expect(screen.getByText("No applications in this view.")).toBeTruthy();
			expect(screen.getByText("Select an application.")).toBeTruthy();
		});
	});

	it("submits scoped request-changes payloads from rendered controls", async () => {
		const requestChanges = vi.fn().mockResolvedValue({ ok: true });
		render(
			React.createElement(BrokerOnboardingReviewWorkspace, {
				actions: createActions({ requestChanges }),
				dossier: createDossier(),
				onSelectedIdChange: vi.fn(),
				onViewChange: vi.fn(),
				queue: [createQueueItem()],
				selectedId: APPLICATION_ID,
				view: "submitted",
			})
		);
		await screen.findByText("Normalized Evidence");

		fireEvent.click(screen.getByLabelText("License number"));
		fireEvent.click(screen.getByLabelText("Require regulator reverification"));
		fireEvent.change(screen.getByPlaceholderText("Reviewer note"), {
			target: { value: "License number needs another regulator check." },
		});
		fireEvent.click(screen.getByRole("button", { name: /request changes/i }));

		await waitFor(() => {
			expect(requestChanges).toHaveBeenCalledWith({
				applicationId: APPLICATION_ID,
				reopenedFields: [{ fieldPath: "draftData.licenseNumber" }],
				reverificationFlags: {
					identityVerification: false,
					regulatorLookup: true,
				},
				reviewerNote: "License number needs another regulator check.",
			});
		});
	});

	it("hides review commands for non-submitted applications", async () => {
		render(
			React.createElement(BrokerOnboardingReviewWorkspace, {
				actions: createActions(),
				dossier: createDossier({
					application: {
						...createDossier().application,
						status: "approved",
					},
				}),
				onSelectedIdChange: vi.fn(),
				onViewChange: vi.fn(),
				queue: [createQueueItem({ status: "approved" })],
				selectedId: APPLICATION_ID,
				view: "submitted",
			})
		);

		await screen.findByText(
			"No review actions are available for approved applications."
		);
		expect(
			screen.queryByRole("button", { name: /^approve$/i })
		).toBeNull();
	});
});
