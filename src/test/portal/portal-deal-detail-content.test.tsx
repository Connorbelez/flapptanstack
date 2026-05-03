/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	PortalDealDetailContent,
	type PortalDealDetailContentProps,
} from "#/components/portal/deals/PortalDealDetailPage";

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}));

type PortalDealDetail = NonNullable<PortalDealDetailContentProps["detail"]>;

function getCardByTitle(name: string) {
	const title = screen.getByText(name);
	const card = title.closest('[data-slot="card"]');
	expect(card).not.toBeNull();
	return card as HTMLElement;
}

function buildPortalDetail() {
	return {
		deal: {
			closingDate: Date.now(),
			dealId: "deal_1",
			fractionalShare: 2500,
			status: "document_review_pending",
		},
		documentInstances: [
			{
				archivedAt: null,
				archivedSigning: {
					completionCertificateUrl: "https://example.com/certificate.pdf",
					finalPdfUrl: "https://example.com/final.pdf",
					signingCompletedAt: Date.now(),
				},
				class: "private_templated_signable",
				displayName: "Signed active packet",
				instanceId: "instance_active",
				kind: "generated",
				lastError: null,
				packageLabel: "Closing package",
				signing: {
					canLaunchEmbeddedSigning: false,
					envelopeId: "envelope_active",
					generatedDocumentSigningStatus: "completed",
					lastError: null,
					lastProviderSyncAt: Date.now(),
					providerCode: "documenso",
					providerEnvelopeId: "doc_env_active",
					recipients: [
						{
							email: "signed@test.fairlend.ca",
							isCurrentViewer: false,
							name: "Sally Signed",
							platformRole: "borrower_primary",
							providerRecipientId: "recipient_active",
							providerRole: "SIGNER",
							signingOrder: 1,
							status: "signed",
							userId: "user_active",
						},
					],
					status: "completed",
				},
				status: "signed",
				url: "https://example.com/final.pdf",
			},
			{
				archivedAt: Date.now(),
				archivedSigning: null,
				class: "private_templated_signable",
				displayName: "Archived provider error packet",
				instanceId: "instance_archived",
				kind: "generated",
				lastError: "Documenso cleanup ended with status not_deletable",
				packageLabel: "Closing package",
				signing: {
					canLaunchEmbeddedSigning: false,
					envelopeId: "envelope_archived",
					generatedDocumentSigningStatus: "provider_error",
					lastError: "Documenso cleanup ended with status not_deletable",
					lastProviderSyncAt: Date.now(),
					providerCode: "documenso",
					providerEnvelopeId: "doc_env_archived",
					recipients: [
						{
							email: "ada@test.fairlend.ca",
							isCurrentViewer: false,
							name: "Ada Borrower",
							platformRole: "borrower_primary",
							providerRecipientId: "recipient_archived",
							providerRole: "SIGNER",
							signingOrder: 1,
							status: "pending",
							userId: "user_archived",
						},
					],
					status: "provider_error",
				},
				status: "archived",
				url: null,
			},
		],
		documentPackage: {
			archivedAt: null,
			lastError: null,
			packageId: "package_1",
			readyAt: Date.now(),
			retryCount: 1,
			status: "ready",
		},
		mortgage: {
			interestRate: 9.5,
			maturityDate: "2027-05-16",
			paymentAmount: 2500,
			paymentFrequency: "monthly",
			principal: 500_000,
			status: "active",
		},
		parties: {
			lender: { name: "Lena Lender" },
			seller: { name: "Sam Seller" },
		},
		property: null,
	} as unknown as PortalDealDetail;
}

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("portal deal detail content", () => {
	it("keeps active signed documents separate from archived signable attempts", () => {
		render(
			<PortalDealDetailContent
				audience="broker"
				createEmbeddedSigningSession={vi.fn()}
				detail={buildPortalDetail()}
				renderBackLink={(children) => <a href="/broker">{children}</a>}
				syncSignableDocumentEnvelope={vi.fn()}
			/>
		);

		const signableCard = getCardByTitle("Signable Documents");
		const archivedCard = getCardByTitle("Archived Signable Documents");

		expect(within(signableCard).getByText("Signed active packet")).toBeTruthy();
		expect(
			within(signableCard).queryByText("Archived provider error packet")
		).toBeNull();
		expect(
			within(archivedCard).getByText("Archived provider error packet")
		).toBeTruthy();
		expect(within(archivedCard).queryByText("Signed active packet")).toBeNull();
		expect(
			within(archivedCard).getByText(
				"Provider error needs resolution before signing can continue."
			)
		).toBeTruthy();
	});
});
