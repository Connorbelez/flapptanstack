/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScheduleReplacementDialog } from "#/components/admin/financial-ledger/schedule-replacement/ScheduleReplacementDialog";
import type { Id } from "../../../convex/_generated/dataModel";

const convexHooks = vi.hoisted(() => ({
	action: vi.fn(async () => ({ outcome: "activated" })),
	context: undefined as unknown,
	draft: undefined as unknown,
	mutation: vi.fn(async () => ({
		draftId: "draft-1" as Id<"paymentScheduleReplacementDrafts">,
	})),
}));

vi.mock("convex/react", () => ({
	useAction: vi.fn(() => convexHooks.action),
	useMutation: vi.fn(() => convexHooks.mutation),
	useQuery: vi.fn((_ref: unknown, args: unknown) => {
		if (args === "skip") {
			return undefined;
		}
		if (args && typeof args === "object" && "mortgageId" in args) {
			return convexHooks.context;
		}
		if (args && typeof args === "object" && "draftId" in args) {
			return convexHooks.draft;
		}
		return undefined;
	}),
}));

class ResizeObserverMock implements ResizeObserver {
	disconnect() {}
	observe() {}
	unobserve() {}
}

const mortgageId = "mortgage-1" as Id<"mortgages">;
const bankAccountId = "bank-account-1" as Id<"bankAccounts">;
const padAuthorizationAssetId = "document-asset-1" as Id<"documentAssets">;

type ProviderDraftPatch = Partial<{
	bankAccountId?: Id<"bankAccounts">;
	interestPaymentAmount: number;
	lastError?: string;
	padAuthorizationAssetId?: Id<"documentAssets">;
	paymentFrequency: "accelerated_bi_weekly" | "bi_weekly" | "monthly" | "weekly";
	replacementRail: "app_managed_manual" | "provider_managed_rotessa";
	startDate: number;
	status:
		| "draft"
		| "ready"
		| "activating"
		| "activated"
		| "activation_failed"
		| "cancelled";
	validationIssues: Array<{ code: string; message: string; rowKey?: string }>;
}>;

function providerDraft(patch: ProviderDraftPatch = {}) {
	return {
		bankAccountId,
		interestPaymentAmount: 10_000,
		padAuthorizationAssetId,
		paymentFrequency: "monthly" as const,
		previewRows: [
			{
				amount: 10_000,
				dueDate: Date.UTC(2026, 1, 15),
				editableDate: false,
				executionMode: "provider_managed" as const,
				kind: "replacement_interest" as const,
				obligationType: "regular_interest" as const,
				paymentNumber: 5,
				rowKey: "generated-interest-5",
				scheduledDate: Date.UTC(2026, 1, 15),
				status: "generated" as const,
			},
			{
				amount: 900_000,
				dueDate: Date.UTC(2026, 2, 15),
				editableDate: false,
				executionMode: "app_owned" as const,
				kind: "replacement_principal" as const,
				obligationType: "principal_repayment" as const,
				paymentNumber: 6,
				rowKey: "generated-principal-6",
				scheduledDate: Date.UTC(2026, 2, 15),
				status: "generated" as const,
			},
		],
		replacementRail: "provider_managed_rotessa" as const,
		sliderBounds: {
			maxInterestPaymentAmount: 40_000,
			maxInterestRows: 4,
			minInterestPaymentAmount: 10_000,
			step: 100,
		},
		startDate: Date.UTC(2026, 1, 15),
		status: "ready" as const,
		validationIssues: [],
		...patch,
	};
}

const baseProviderContext = {
	archiveCandidateRows: [],
	borrowerId: "borrower-1",
	borrowerLabel: "Borrower One",
	currentRailLabel: "Provider-managed Rotessa",
	deadlineDate: Date.UTC(2026, 5, 15),
	deadlineIsoDate: "2026-06-15",
	eligibleBankAccounts: [
		{
			accountLast4: "4567",
			bankAccountId,
			label: "Bank account ending 4567",
			mandateStatus: "active",
			status: "validated",
		},
	],
	maturityDate: "2026-04-15",
	minStartDate: Date.UTC(2026, 1, 15),
	mortgageId,
	outstandingInterestAmount: 40_000,
	previewContextRows: [],
	principalPayoffAmount: 900_000,
	suggestedDraft: providerDraft(),
};

beforeEach(() => {
	vi.stubGlobal("ResizeObserver", ResizeObserverMock);
	convexHooks.context = baseProviderContext;
	convexHooks.draft = undefined;
	convexHooks.action.mockClear();
	convexHooks.mutation.mockClear();
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("payment schedule replacement dialog workflow", () => {
	it("keeps provider-managed drafts disabled until PAD requirements are satisfied and does not expose row date editing", () => {
		convexHooks.context = {
			...baseProviderContext,
			suggestedDraft: providerDraft({
				padAuthorizationAssetId: undefined,
				status: "draft",
				validationIssues: [
					{
						code: "provider_pad_required",
						message:
							"Provider-managed Rotessa schedules require a PAD authorization document.",
					},
				],
			}),
		};

		render(
			<ScheduleReplacementDialog
				mortgageId={mortgageId}
				onOpenChange={vi.fn()}
				open
			/>
		);

		expect(
			screen
				.getByRole("button", { name: /apply replacement/i })
				.hasAttribute("disabled")
		).toBe(true);
		expect(
			screen.queryByRole("button", { name: /adjust generated-interest-5/i })
		).toBeNull();
		expect(
			screen.getByText(/cancels any replaced Rotessa provider schedule/i)
		).not.toBeNull();
	});

	it("allows provider-managed activation failures to be retried and shows the provider error", () => {
		convexHooks.context = {
			...baseProviderContext,
			suggestedDraft: providerDraft({
				lastError: "Rotessa create failed",
				status: "activation_failed",
			}),
		};

		render(
			<ScheduleReplacementDialog
				mortgageId={mortgageId}
				onOpenChange={vi.fn()}
				open
			/>
		);

		const retryButton = screen.getByRole("button", {
			name: /retry replacement/i,
		});
		expect(retryButton.hasAttribute("disabled")).toBe(false);
		expect(screen.getByText("Rotessa create failed")).not.toBeNull();
	});

	it("keeps apply from racing a pending draft save", async () => {
		const user = userEvent.setup();
		let resolveSave: (
			value: { draftId: Id<"paymentScheduleReplacementDrafts"> }
		) => void;
		convexHooks.mutation.mockImplementationOnce(
			() =>
				new Promise<{ draftId: Id<"paymentScheduleReplacementDrafts"> }>(
					(resolve) => {
						resolveSave = resolve;
					}
				)
		);

		render(
			<ScheduleReplacementDialog
				mortgageId={mortgageId}
				onOpenChange={vi.fn()}
				open
			/>
		);

		await user.click(screen.getByRole("radio", { name: /manual collection/i }));

		expect(
			screen
				.getByRole("button", { name: /apply replacement/i })
				.hasAttribute("disabled")
		).toBe(true);
		expect(convexHooks.action).not.toHaveBeenCalled();

		resolveSave!({
			draftId: "draft-after-save" as Id<"paymentScheduleReplacementDrafts">,
		});

		await waitFor(() => {
			expect(
				screen
					.getByRole("button", { name: /apply replacement/i })
					.hasAttribute("disabled")
			).toBe(false);
		});
		await user.click(screen.getByRole("button", { name: /apply replacement/i }));

		await waitFor(() => {
			expect(convexHooks.action).toHaveBeenCalledWith({
				draftId: "draft-after-save",
			});
		});
	});
});
