/**
 * @vitest-environment jsdom
 */

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { portfolioRenewalIntentFixture } from "#/components/lender/portfolio/fixtures";
import { usePortfolioRenewalActions } from "#/components/lender/portfolio/renewals/use-renewal-actions";
import {
	adminLenderPortfolioRenewalIntentQueryOptions,
	lenderPortfolioRenewalIntentQueryOptions,
} from "#/components/lender/portfolio/query-options";

vi.mock("@tanstack/react-query", () => ({
	useQuery: vi.fn(),
}));

vi.mock("convex/react", () => ({
	useMutation: vi.fn(),
}));

vi.mock("#/components/lender/portfolio/query-options", () => ({
	adminLenderPortfolioRenewalIntentQueryOptions: vi.fn(),
	lenderPortfolioRenewalIntentQueryOptions: vi.fn(),
}));

const PORTAL_ID = "portal_meridian" as never;

describe("usePortfolioRenewalActions", () => {
	beforeEach(() => {
		vi.mocked(useQuery).mockReturnValue({
			data: portfolioRenewalIntentFixture,
			error: null,
			isPending: false,
		} as never);
		vi.mocked(lenderPortfolioRenewalIntentQueryOptions).mockReturnValue({
			queryKey: ["renewal-intent"],
		} as never);
		vi.mocked(adminLenderPortfolioRenewalIntentQueryOptions).mockReturnValue({
			queryKey: ["admin-renewal-intent"],
		} as never);
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("sets the submit error and rethrows failed renewal mutations", async () => {
		const signalRenewalIntent = vi
			.fn()
			.mockRejectedValue(new Error("Permission denied"));
		vi.mocked(useMutation).mockReturnValue(signalRenewalIntent as never);

		const { result } = renderHook(() =>
			usePortfolioRenewalActions({
				mode: { kind: "portal", portalId: PORTAL_ID },
				mortgageId: "mortgage_king",
			})
		);

		await act(async () => {
			await expect(
				result.current.submitIntent({ intent: "renew" })
			).rejects.toThrow("Permission denied");
		});

		expect(result.current.submitErrorMessage).toBe("Permission denied");
		expect(result.current.isSubmitting).toBe(false);
	});

	it("clears submit errors when the renewal action scope changes", async () => {
		const signalRenewalIntent = vi
			.fn()
			.mockRejectedValue(new Error("Unable to update mortgage A"));
		vi.mocked(useMutation).mockReturnValue(signalRenewalIntent as never);

		const { result, rerender } = renderHook(
			({ mortgageId }) =>
				usePortfolioRenewalActions({
					mode: { kind: "portal", portalId: PORTAL_ID },
					mortgageId,
				}),
			{ initialProps: { mortgageId: "mortgage_a" } }
		);

		await act(async () => {
			await expect(
				result.current.submitIntent({ intent: "renew" })
			).rejects.toThrow("Unable to update mortgage A");
		});
		expect(result.current.submitErrorMessage).toBe("Unable to update mortgage A");

		rerender({ mortgageId: "mortgage_b" });

		await waitFor(() => {
			expect(result.current.submitErrorMessage).toBeUndefined();
			expect(result.current.isSubmitting).toBe(false);
		});
	});

	it("ignores late submit failures from a previous renewal action scope", async () => {
		let rejectSubmit: (error: Error) => void = () => undefined;
		const pendingSubmit = new Promise<void>((_, reject) => {
			rejectSubmit = reject;
		});
		const signalRenewalIntent = vi.fn().mockReturnValue(pendingSubmit);
		vi.mocked(useMutation).mockReturnValue(signalRenewalIntent as never);

		const { result, rerender } = renderHook(
			({ mortgageId }) =>
				usePortfolioRenewalActions({
					mode: { kind: "portal", portalId: PORTAL_ID },
					mortgageId,
				}),
			{ initialProps: { mortgageId: "mortgage_a" } }
		);

		const submitPromise = result.current.submitIntent({ intent: "renew" });
		rerender({ mortgageId: "mortgage_b" });

		await act(async () => {
			rejectSubmit(new Error("Old mortgage failure"));
			await expect(submitPromise).rejects.toThrow("Old mortgage failure");
		});

		expect(result.current.submitErrorMessage).toBeUndefined();
		expect(result.current.isSubmitting).toBe(false);
	});
});
