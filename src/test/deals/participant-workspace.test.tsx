/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ParticipantDealsQueuePage } from "#/components/deals/participant/ParticipantDealsQueuePage";
import { ParticipantDealWorkspacePage } from "#/components/deals/participant/ParticipantDealWorkspacePage";
import { BorrowerLayout } from "#/routes/borrower/route";
import { LenderLayout } from "#/routes/lender/route";
import { api } from "../../../convex/_generated/api";

const convexReactMocks = vi.hoisted(() => ({
	createParticipantSigningSession: vi.fn(async () => ({
		expiresAt: 1_800_000_120_000,
		url: "https://documenso.test/sign/session_1",
	})),
}));

vi.mock("react", async () => {
	const { createRequire } =
		await vi.importActual<typeof import("node:module")>("node:module");
	const require = createRequire(import.meta.url);
	const reactCjs = require("react") as typeof import("react");
	return {
		...reactCjs,
		default: reactCjs,
	};
});

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (config: Record<string, unknown>) => config,
	Link: ({
			children,
			to,
		}: {
			children: ReactNode;
			params?: Record<string, string>;
			to: string;
		}) => <a href={to}>{children}</a>,
	Outlet: () => <div data-testid="participant-route-outlet" />,
}));

vi.mock("convex/react", () => ({
	Authenticated: ({ children }: { children: ReactNode }) => (
		<div data-testid="authenticated-shell">{children}</div>
	),
	AuthLoading: ({ children }: { children: ReactNode }) => (
		<div data-testid="auth-loading-shell">{children}</div>
	),
	useAction: () => convexReactMocks.createParticipantSigningSession,
	useMutation: () => vi.fn(async () => ({ success: true })),
}));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	convexReactMocks.createParticipantSigningSession.mockClear();
});

type ParticipantDealQueue = FunctionReturnType<
	typeof api.deals.queries.getParticipantDealQueue
>;
type ParticipantDealWorkspace = NonNullable<
	FunctionReturnType<typeof api.deals.queries.getParticipantDealWorkspace>
>;

const queue: ParticipantDealQueue = {
	completed: [],
	inProgress: [],
	needsAction: [
		{
			closingDate: 1_800_000_000_000,
			dealId: "deal_123" as never,
			group: "needsAction",
			nextAction: "Sign your buyer closing documents",
			persona: "buyer",
			propertyLabel: "123 King St W, Toronto, ON",
			signingStatus: "ready_to_sign",
			status: "documentReview.signed",
		},
	],
	persona: "buyer",
};

const workspace: ParticipantDealWorkspace = {
	blockers: [],
	closeReceipt: {
		closedAt: null,
		funds: null,
		signedArchiveStatus: null,
	},
	deal: {
		closingDate: 1_800_000_000_000,
		dealId: "deal_123" as never,
		fractionalShare: 2500,
		fractionalShareDisplayPercent: 25,
		fractionalShareUnits: 2500,
		lockingFeeAmount: null,
		persona: "buyer",
		status: "documentReview.signed",
	},
	documentInstances: [
		{
			class: "private_templated_signable",
			displayName: "Closing Signature Package",
			instanceId: "instance_123" as never,
			kind: "generated",
			packageLabel: "Closing",
			signingState: null,
			status: "signature_sent",
			url: null,
		},
	],
	documentPackage: {
		readyAt: 1_800_000_000_000,
		status: "ready",
	},
	legalRepresentation: {
		actions: {
			changeGuestEmail: { allowed: true, reason: null },
			replaceLawyer: { allowed: true, reason: null },
			resendInvitation: { allowed: true, reason: null },
		},
		activeLawyerAccessCount: 1,
		currentInvitation: {
			acceptedAt: null,
			deliveredAt: 1_800_000_000_000,
			deliveryError: null,
			deliveryProvider: "workos",
			deliveryStatus: "sent",
			expiresAt: 1_800_000_100_000,
			invitationId: "invitation_123" as never,
			lastDeliveryAttemptAt: 1_800_000_000_000,
			status: "pending",
			targetEmail: "lawyer@test.fairlend.ca",
			updatedAt: 1_800_000_000_000,
			workosInvitationId: "workos_invitation_123",
		},
		gate: {
			message: "Signed representation engagement evidence is required.",
			reasonCodes: ["engagement_missing"],
		},
		kind: "guest_invitation_sent",
		label: "Guest invitation sent",
		selectedLawyer: {
			email: "lawyer@test.fairlend.ca",
			lawyerId: "lawyer@test.fairlend.ca",
			name: "Laura Lawyer",
			type: "guest_lawyer",
		},
		showInDealViews: true,
		summary: "Invitation is pending for lawyer@test.fairlend.ca.",
	},
	mortgage: {
		interestRate: 9.5,
		maturityDate: "2031-01-01",
		mortgageId: "mortgage_123" as never,
		paymentAmount: 2500,
		paymentFrequency: "monthly",
		principal: 500_000,
		status: "funded",
	},
	nextAction: "Sign your buyer closing documents",
	participants: {
		buyer: {
			accessRole: "lender",
			authId: "buyer-auth",
			displayName: "Bianca Buyer",
			email: "buyer@test.fairlend.ca",
			lenderId: "lender_123" as never,
			userId: "user_123" as never,
		},
		dealId: "deal_123" as never,
		fractionalShareDisplayPercent: 25,
		fractionalShareStatus: {
			fractionalShareDisplayPercent: 25,
			fractionalShareUnits: 2500,
			isValid: true,
			validationError: null,
		},
		fractionalShareUnits: 2500,
		lawyer: {
			authId: "lawyer-auth",
			displayName: "Laura Lawyer",
			email: "lawyer@test.fairlend.ca",
			hasActiveDealAccess: true,
			lawyerType: "guest_lawyer",
		},
		personas: {
			admin: "admin",
			buyer: "buyer",
			lawyer: "lawyer",
			seller: "seller",
		},
		seller: {
			accessRole: "borrower",
			authId: "seller-auth",
			borrowerId: "borrower_123" as never,
			displayName: "Sam Seller",
			email: "seller@test.fairlend.ca",
			lenderId: null,
			userId: "user_456" as never,
		},
	},
	parties: {
		assignedLawyer: {
			email: "lawyer@test.fairlend.ca",
			name: "Laura Lawyer",
		},
		lender: {
			email: "buyer@test.fairlend.ca",
			name: "Bianca Buyer",
		},
		seller: {
			email: "seller@test.fairlend.ca",
			name: "Sam Seller",
		},
	},
	persona: "buyer",
	property: {
		city: "Toronto",
		propertyType: "residential",
		province: "ON",
		streetAddress: "123 King St W",
		unit: null,
	},
	queueGroup: "needsAction",
	signing: {
		attemptId: "attempt_123" as never,
		completedRequiredCount: 0,
		embeddedSigningToken: "buyer-token",
		exceptionMessage: null,
		providerDocumentId: "doc_123",
		providerEnvelopeId: "env_123",
		recipientName: "Bianca Buyer",
		recipients: [
			{
				completedAt: null,
				documensoRole: "SIGNER",
				name: "Bianca Buyer",
				platformRole: "lender_primary",
				required: true,
				signingOrder: 1,
				signingStatus: "not_started",
			},
		],
		requiredCount: 2,
		status: "ready_to_sign",
		tokenExpiresAt: 1_800_000_060_000,
	},
	timeline: [
		{
			at: 1_800_000_000_000,
			description: "The closing workspace was created.",
			label: "Deal opened",
			status: "complete",
		},
	],
};

describe("participant deal workspace UI", () => {
	it("renders queue groups and buyer next action", () => {
		render(<ParticipantDealsQueuePage queue={queue} />);

		expect(screen.getByText("My Closings")).toBeTruthy();
		expect(screen.getByText("Needs Action")).toBeTruthy();
		expect(screen.getByText("123 King St W, Toronto, ON")).toBeTruthy();
		expect(screen.getByText("Sign your buyer closing documents")).toBeTruthy();
	});

	it("renders workspace panels and opens signing through the app action", async () => {
		const open = vi.spyOn(window, "open").mockReturnValue(null);

		render(
			<ParticipantDealWorkspacePage backTo="/lender/deals" workspace={workspace} />
		);

		expect(screen.getByText("Overview")).toBeTruthy();
		expect(screen.getByText("Legal Representation")).toBeTruthy();
		expect(screen.getByText("Guest invitation sent")).toBeTruthy();
		expect(screen.getByRole("button", { name: /resend/i })).toBeTruthy();
		expect(screen.getByText("Documents & Signatures")).toBeTruthy();
		expect(screen.getByText("Timeline")).toBeTruthy();
		expect(screen.getByText("Parties & Counsel")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: /open signing/i }));
		await waitFor(() =>
			expect(convexReactMocks.createParticipantSigningSession).toHaveBeenCalledWith({
				attemptId: "attempt_123",
				dealId: "deal_123",
			})
		);
		expect(open).toHaveBeenCalledWith(
			"https://documenso.test/sign/session_1",
			"_blank",
			"noopener,noreferrer"
		);
		expect(
			document.querySelector('a[href="buyer-token"]')
		).toBeNull();
		expect(screen.queryByText("lawyer-token")).toBeNull();
	});

	it("does not launch signing without a projected attempt", () => {
		render(
			<ParticipantDealWorkspacePage
				backTo="/lender/deals"
				workspace={{
					...workspace,
					signing: {
						...workspace.signing,
						attemptId: null,
					},
				}}
			/>
		);

		expect(screen.getByText("Signing task ready")).toBeTruthy();
		expect(screen.queryByRole("button", { name: /open signing/i })).toBeNull();
	});

	it("wraps lender and borrower route trees before suspense children render", () => {
		render(<LenderLayout />);
		expect(screen.getByTestId("authenticated-shell")).toBeTruthy();
		expect(screen.getByTestId("auth-loading-shell")).toBeTruthy();
		expect(screen.getByTestId("participant-route-outlet")).toBeTruthy();

		cleanup();

		render(<BorrowerLayout />);
		expect(screen.getByTestId("authenticated-shell")).toBeTruthy();
		expect(screen.getByTestId("auth-loading-shell")).toBeTruthy();
		expect(screen.getByTestId("participant-route-outlet")).toBeTruthy();
	});
});
