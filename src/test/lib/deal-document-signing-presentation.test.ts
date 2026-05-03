import { describe, expect, it } from "vitest";
import {
	describeSigningProgress,
	groupSignableDealDocuments,
} from "#/lib/deal-document-signing-presentation";

describe("deal document signing presentation", () => {
	it("groups signable documents by archived state instead of final PDF availability", () => {
		const grouped = groupSignableDealDocuments([
			{
				archivedAt: null,
				class: "private_templated_signable",
				status: "signed",
			},
			{
				archivedAt: Date.now(),
				class: "private_templated_signable",
				status: "archived",
			},
			{
				archivedAt: null,
				class: "private_templated_non_signable",
				status: "available",
			},
		]);

		expect(grouped.activeSignableDocuments).toHaveLength(1);
		expect(grouped.activeSignableDocuments[0]?.status).toBe("signed");
		expect(grouped.archivedSignableDocuments).toHaveLength(1);
		expect(grouped.archivedSignableDocuments[0]?.status).toBe("archived");
	});

	it("summarizes the next sequential signer", () => {
		expect(
			describeSigningProgress({
				envelopeId: "envelope_1",
				recipients: [
					{
						name: "Ada Borrower",
						providerRole: "SIGNER",
						signingOrder: 1,
						status: "signed",
					},
					{
						name: "Layla Lawyer",
						providerRole: "APPROVER",
						signingOrder: 2,
						status: "pending",
					},
				],
				status: "partially_signed",
			})
		).toBe("Waiting on: Layla Lawyer (APPROVER)");
	});

	it("groups parallel recipients at the same signing order", () => {
		expect(
			describeSigningProgress({
				envelopeId: "envelope_1",
				recipients: [
					{
						name: "Ada Borrower",
						providerRole: "SIGNER",
						signingOrder: 1,
						status: "pending",
					},
					{
						name: "Bailey Borrower",
						providerRole: "SIGNER",
						signingOrder: 1,
						status: "opened",
					},
					{
						name: "Layla Lawyer",
						providerRole: "APPROVER",
						signingOrder: 2,
						status: "pending",
					},
				],
				status: "sent",
			})
		).toBe("Waiting on: Ada Borrower (SIGNER), Bailey Borrower (SIGNER)");
	});

	it("does not report a waiting signer for terminal or blocked envelope states", () => {
		expect(
			describeSigningProgress({
				envelopeId: null,
				recipients: [
					{
						name: "Ada Borrower",
						providerRole: "SIGNER",
						signingOrder: 1,
						status: "pending",
					},
				],
				status: "provider_error",
			})
		).toBe("Provider error needs resolution before signing can continue.");

		expect(
			describeSigningProgress({
				envelopeId: "envelope_1",
				recipients: [
					{
						name: "Ada Borrower",
						providerRole: "SIGNER",
						signingOrder: 1,
						status: "pending",
					},
				],
				status: "voided",
			})
		).toBe("Envelope has been voided.");
	});
});
