/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation } from "convex/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentProofUploader } from "#/components/deals/portal/PaymentProofUploader";
import type { Id } from "../../../convex/_generated/dataModel";

vi.mock("convex/react", () => ({
	useMutation: vi.fn(),
}));

const useMutationMock = vi.mocked(useMutation);

const generateUploadUrl = vi.fn(async () => ({
	uploadUrl: "https://uploads.example.test/payment-proof",
}));
const createAsset = vi.fn(async () => ({
	assetId: "asset-payment-proof" as Id<"documentAssets">,
}));
const uploadProof = vi.fn(async () => undefined);

function renderUploader() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
		},
	});

	return render(
		<QueryClientProvider client={queryClient}>
			<PaymentProofUploader dealId={"deal-1" as Id<"deals">} />
		</QueryClientProvider>
	);
}

beforeEach(() => {
	let mutationIndex = 0;
	const mutationFns = [generateUploadUrl, createAsset, uploadProof] as const;
	useMutationMock.mockImplementation(() => {
		const mutation = mutationFns[mutationIndex % mutationFns.length];
		mutationIndex += 1;
		return mutation;
	});
	vi.stubGlobal(
		"fetch",
		vi.fn(async () =>
			Response.json({ storageId: "storage-payment-proof" as Id<"_storage"> })
		)
	);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("PaymentProofUploader", () => {
	it("submits decimal dollar amounts as integer cents", async () => {
		const user = userEvent.setup();
		renderUploader();

		await user.type(screen.getByLabelText("Amount"), "123.45");
		await user.type(screen.getByLabelText("Sending Party"), "Lender trust");
		await user.upload(
			screen.getByLabelText("Receipt"),
			new File(["receipt"], "receipt.pdf", { type: "application/pdf" })
		);
		await user.click(screen.getByRole("button", { name: /upload proof/i }));

		await waitFor(() => {
			expect(uploadProof).toHaveBeenCalledWith(
				expect.objectContaining({
					amount: 12_345,
					currency: "CAD",
				})
			);
		});
	});
});
