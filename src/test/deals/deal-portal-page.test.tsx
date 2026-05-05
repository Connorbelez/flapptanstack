/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DealPortalShell } from "#/components/deals/portal/DealPortalShell";

vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("convex/react", () => ({
	useAction: () => vi.fn(async () => ({ expiresAt: 1, url: "https://sign.test" })),
	useMutation: () => vi.fn(async () => ({ assetId: "asset_test" })),
}));

afterEach(() => {
	cleanup();
});

const baseWorkspace = {
	activeScreen: "representation",
	blockers: [],
	capabilities: [],
	completion: { completed: false, completedAt: null },
	deal: {
		closingDate: null,
		createdAt: 1,
		dealId: "deal_test",
		fractionalShareDisplayPercent: 25,
		fractionalShareUnits: 2500,
		lawyerId: "lawyer-auth",
		lawyerType: "guest_lawyer",
		lenderId: "lender_test",
		mortgageId: "mortgage_test",
		selectedLawyer: {
			email: "lawyer@example.test",
			name: "Laura Lawyer",
			type: "guest_lawyer",
		},
		status: "lawyerOnboarding.pending",
	},
	documents: { instances: [], package: null, participants: null },
	onboarding: {
		nextRoute: null,
		required: false,
		sessionId: null,
	},
	participants: {
		buyer: { displayName: "Lena Lender" },
		dealId: "deal_test",
		fractionalShareDisplayPercent: 25,
		fractionalShareStatus: {
			fractionalShareDisplayPercent: 25,
			fractionalShareUnits: 2500,
			isValid: true,
			validationError: null,
		},
		fractionalShareUnits: 2500,
		involvedParties: [
			{
				email: "lender@example.test",
				hasWorkspaceAccess: true,
				label: "Purchasing lender",
				name: "Lena Lender",
				role: "purchasing_lender",
			},
			{
				email: "seller@example.test",
				hasWorkspaceAccess: true,
				label: "Selling lender",
				name: "Sam Selling",
				role: "selling_lender",
			},
			{
				email: "lawyer@example.test",
				hasWorkspaceAccess: true,
				label: "Primary lawyer",
				name: "Laura Lawyer",
				role: "primary_lawyer",
			},
			{
				email: "broker@example.test",
				hasWorkspaceAccess: true,
				label: "Broker",
				name: "Bryn Broker",
				role: "broker_of_record",
			},
			{
				email: "borrower@example.test",
				hasWorkspaceAccess: true,
				label: "Primary borrower",
				name: "Bailey Borrower",
				role: "primary_borrower",
			},
		],
		lawyer: {
			displayName: "Laura Lawyer",
			hasActiveDealAccess: true,
			lawyerType: "guest_lawyer",
		},
		personas: {
			assigned_broker: "assigned_broker",
			broker_of_record: "broker_of_record",
			fairlend_admin: "fairlend_admin",
			primary_borrower: "primary_borrower",
			primary_lawyer: "primary_lawyer",
			purchasing_lender: "purchasing_lender",
			selling_lender: "selling_lender",
		},
		primary_borrower: {
			authId: "borrower-auth",
			borrowerId: "borrower_test",
			displayName: "Bailey Borrower",
			email: "borrower@example.test",
			persona: "primary_borrower",
			userId: "user_borrower",
		},
		primary_lawyer: {
			authId: "lawyer-auth",
			displayName: "Laura Lawyer",
			email: "lawyer@example.test",
			hasActiveDealAccess: true,
			lawyerType: "guest_lawyer",
			persona: "primary_lawyer",
		},
		purchasing_lender: {
			accessRole: "lender",
			authId: "lender-auth",
			displayName: "Lena Lender",
			email: "lender@example.test",
			lenderId: "lender_test",
			persona: "purchasing_lender",
			userId: "user_lender",
		},
		seller: { displayName: "Sam Selling" },
		selling_lender: {
			accessRole: "lender",
			authId: "seller-auth",
			displayName: "Sam Selling",
			email: "seller@example.test",
			lenderId: "seller_lender_test",
			persona: "selling_lender",
			userId: "user_seller",
		},
	},
	payment: { adminReview: null, hasApprovedProof: false, hasPendingProof: false, proofs: [] },
	representation: {
		actions: {
			changeGuestEmail: { allowed: true, reason: null },
			replaceLawyer: { allowed: true, reason: null },
			resendInvitation: { allowed: true, reason: null },
		},
		activeLawyerAccessCount: 1,
		currentInvitation: {
			acceptedAt: null,
			deliveredAt: 1,
			deliveryError: null,
			deliveryProvider: "workos",
			deliveryStatus: "sent",
			expiresAt: 1,
			invitationId: "invite_test",
			lastDeliveryAttemptAt: 1,
			status: "pending",
			targetEmail: "lawyer@example.test",
			updatedAt: 1,
			workosInvitationId: "workos_invite_test",
		},
		gate: {
			message: "Current eligible lawyer verification evidence is required.",
			reasonCodes: ["license_not_found"],
		},
		kind: "guest_invitation_sent",
		label: "Guest invitation sent",
		selectedLawyer: {
			email: "lawyer@example.test",
			name: "Laura Lawyer",
			type: "guest_lawyer",
		},
		showInDealViews: true,
		summary: "Invitation is pending.",
	},
	viewer: {
		authId: "lender-auth",
		email: "lender@example.test",
		isFairLendAdmin: false,
		persona: "purchasing_lender",
		userId: "user_lender",
	},
} as const;

describe("DealPortalShell", () => {
	it("renders representation as the first screen for locked deals", () => {
		render(<DealPortalShell workspace={baseWorkspace as never} />);

		expect(
			screen.getByRole("heading", { name: /legal representation/i })
		).toBeTruthy();
		expect(screen.getByText("Guest invitation sent")).toBeTruthy();
	});

	it("renders a send invite action when a guest lawyer is selected without an invitation row", () => {
		render(
			<DealPortalShell
				workspace={
					{
						...baseWorkspace,
						capabilities: ["representation.invitation.resend"],
						representation: {
							...baseWorkspace.representation,
							currentInvitation: {
								acceptedAt: null,
								deliveredAt: null,
								deliveryError: null,
								deliveryProvider: null,
								deliveryStatus: null,
								expiresAt: null,
								invitationId: null,
								lastDeliveryAttemptAt: null,
								status: "none",
								targetEmail: null,
								updatedAt: null,
								workosInvitationId: null,
							},
						},
					} as never
				}
			/>
		);

		expect(
			screen.getByText(
				"No invitation has been sent to lawyer@example.test."
			)
		).toBeTruthy();
		expect(screen.getByRole("button", { name: /send invite/i })).toBeTruthy();
		expect(screen.getByText("Target email")).toBeTruthy();
	});

	it("renders a progress deal recovery action for satisfied legal representation gates", () => {
		render(
			<DealPortalShell
				workspace={
					{
						...baseWorkspace,
						capabilities: ["representation.progressDeal"],
						representation: {
							...baseWorkspace.representation,
							gate: {
								message: "Legal representation gate is satisfied.",
								reasonCodes: [],
							},
							kind: "guest_verified",
							label: "Guest lawyer verified",
							summary:
								"Laura Lawyer is verified and awaiting representation confirmation.",
						},
						viewer: {
							...baseWorkspace.viewer,
							authId: "lawyer-auth",
							email: "lawyer@example.test",
							persona: "primary_lawyer",
						},
					} as never
				}
			/>
		);

		expect(screen.getByRole("button", { name: /progress deal/i })).toBeTruthy();
	});

	it("does not describe missing document instances as unconfirmed representation after progression", () => {
		render(
			<DealPortalShell
				workspace={
					{
						...baseWorkspace,
						activeScreen: "documents",
						deal: {
							...baseWorkspace.deal,
							status: "documentReview.pending",
						},
						documents: {
							...baseWorkspace.documents,
							instances: [],
							package: null,
						},
						viewer: {
							...baseWorkspace.viewer,
							authId: "lawyer-auth",
							email: "lawyer@example.test",
							persona: "primary_lawyer",
						},
					} as never
				}
			/>
		);

		expect(
			screen.queryByText(/after legal representation is confirmed/i)
		).toBeNull();
		expect(screen.getByText(/document package has not been generated/i)).toBeTruthy();
	});

	it("renders onboarding-required state without lender or lawyer controls", () => {
		render(
			<DealPortalShell
				workspace={
					{
						...baseWorkspace,
						capabilities: ["representation.onboarding.resume"],
						onboarding: {
							nextRoute: "/lawyer/onboarding/session_test",
							required: true,
							sessionId: "session_test",
						},
						viewer: {
							...baseWorkspace.viewer,
							authId: "lawyer-auth",
							persona: "primary_lawyer",
						},
					} as never
				}
			/>
		);

		expect(
			screen.getByRole("heading", { name: /complete legal onboarding/i })
		).toBeTruthy();
			expect(
				screen
					.getByRole("link", { name: /continue onboarding/i })
					.getAttribute("href")
			).toBe("/lawyer/onboarding/session_test");
			expect(screen.queryByRole("heading", { name: "Closing Assembly" })).toBeNull();
			expect(screen.queryByText("Purchasing lender")).toBeNull();
			expect(screen.queryByRole("button", { name: /send invite/i })).toBeNull();
			expect(
				screen.queryByRole("button", { name: /confirm representation/i })
		).toBeNull();
		expect(screen.queryByRole("button", { name: /upload proof/i })).toBeNull();
	});

	it("renders all deal parties below the portal header", () => {
		render(<DealPortalShell workspace={baseWorkspace as never} />);

		expect(screen.getByRole("heading", { name: "Closing Assembly" })).toBeTruthy();
		for (const role of [
			"Purchasing lender",
			"Selling lender",
			"Primary lawyer",
			"Broker",
			"Primary borrower",
		]) {
			expect(screen.getByText(role)).toBeTruthy();
		}
		expect(screen.getAllByLabelText("Signatory")).toHaveLength(5);
	});

	it("renders payment upload for lender on fundsTransfer.pending", () => {
		render(
			<DealPortalShell
				workspace={
					{
						...baseWorkspace,
						activeScreen: "payment",
						capabilities: ["payment.proof.upload"],
						deal: {
							...baseWorkspace.deal,
							status: "fundsTransfer.pending",
						},
					} as never
				}
			/>
		);

		expect(
			screen.getByRole("heading", { name: /payment confirmation/i })
		).toBeTruthy();
		expect(screen.getByRole("button", { name: /upload proof/i })).not.toHaveProperty(
			"disabled",
			true
		);
	});

	it("hides payment upload for seller", () => {
		render(
			<DealPortalShell
				workspace={
					{
						...baseWorkspace,
						activeScreen: "payment",
						capabilities: [],
						deal: {
							...baseWorkspace.deal,
							status: "fundsTransfer.pending",
						},
						viewer: {
							...baseWorkspace.viewer,
							authId: "seller-auth",
							isFairLendAdmin: false,
							persona: "selling_lender",
						},
					} as never
				}
			/>
		);

		expect(screen.queryByRole("button", { name: /upload proof/i })).toBeNull();
		expect(
			screen.getByText(/payment proof is awaiting lender or lawyer action/i)
		).toBeTruthy();
	});

	it("shows admin review controls only for admin", () => {
		render(
			<DealPortalShell
				workspace={
					{
						...baseWorkspace,
						activeScreen: "payment",
						capabilities: [
							"payment.proof.approve",
							"payment.proof.reject",
							"payment.proof.review",
						],
						deal: {
							...baseWorkspace.deal,
							status: "fundsTransfer.pending",
						},
						payment: {
							adminReview: {
								proofs: [
									{
										amount: 125_000,
										attachmentIds: ["asset_1"],
										cashLedgerJournalEntryIds: [],
										cashLedgerPostingGroupId: null,
										currency: "CAD",
										fundsEvidenceId: null,
										institutionName: "Bank",
										leg1TransferId: null,
										leg2TransferId: null,
										note: null,
										proofId: "proof_1",
										referenceNumber: "WIRE-1",
										reviewReason: null,
										reviewedAt: null,
										reviewedBy: null,
										sendingParty: "Lender trust",
										status: "pending_review",
										submittedBy: "lender-auth",
										submittedByRole: "purchasing_lender",
										submittedByPersona: "purchasing_lender",
										transferDate: 1,
									},
								],
							},
							hasApprovedProof: false,
							hasPendingProof: true,
							proofs: [],
						},
						viewer: {
							...baseWorkspace.viewer,
							authId: "admin-auth",
							isFairLendAdmin: true,
							persona: "fairlend_admin",
						},
					} as never
				}
			/>
		);

		expect(screen.getByRole("button", { name: /approve proof/i })).not.toHaveProperty(
			"disabled",
			true
		);
		expect(screen.getByRole("button", { name: /reject proof/i })).not.toHaveProperty(
			"disabled",
			true
		);
	});
});
