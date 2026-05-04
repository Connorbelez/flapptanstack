/**
 * @vitest-environment jsdom
 */

import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { useMutation, useQuery } from "convex/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type {
	AdminDealOperationsCard,
	AdminDealOperationsDetail,
	AdminDealOperationsProjection,
} from "../../../convex/deals/queries";
import { DealOperationActionControls } from "#/components/admin/deals/DealOperationActionControls";
import { DealOperationsConsole } from "#/components/admin/deals/DealOperationsConsole";
import { DealOperationsPipeline } from "#/components/admin/deals/DealOperationsPipeline";

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

vi.mock("convex/react", () => ({
	useMutation: vi.fn(),
	useQuery: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
		Link: ({
			children,
			params,
			to,
			...props
		}: {
			readonly children: ReactNode;
			readonly params?: { readonly recordid?: string };
			readonly to: string;
			readonly [key: string]: unknown;
		}) => {
			const href = params?.recordid
				? to.replace("$recordid", params.recordid)
				: to;
			return (
				<a href={href} {...props}>
					{children}
				</a>
			);
		},
	}));

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}));

const DEAL_ID = "deal_1" as Id<"deals">;
const MORTGAGE_ID = "mortgage_1" as Id<"mortgages">;
const useMutationMock = useMutation as unknown as ReturnType<typeof vi.fn>;
const useQueryMock = useQuery as unknown as ReturnType<typeof vi.fn>;

function createCard(
	overrides: Partial<AdminDealOperationsCard> = {}
): AdminDealOperationsCard {
		return {
			_id: DEAL_ID,
			actions: [
				{
					disabledReason: null,
					event: "DEAL_LOCKED",
					label: "Lock Deal",
					payloadKind: "closing_date",
					requiresPayload: true,
					source: "governed_transition",
				},
				{
					disabledReason: null,
					event: "DEAL_CANCELLED",
					label: "Cancel Deal",
					payloadKind: "cancel_reason",
					requiresPayload: true,
					source: "governed_transition",
				},
			],
			blockers: [
			{
				kind: "package_pending",
				message: "Closing package has not been generated yet.",
				severity: "info",
			},
		],
		closingDate: Date.UTC(2026, 4, 1),
			closingTeam: [
				{
					assignedAt: 1,
					role: "platform_lawyer",
					userId: "user_lawyer",
				},
			],
		createdAt: 1,
		createdBy: "user_admin" as Id<"users">,
		filters: ["all", "needs_action", "blocked"],
		fractionalShareDisplayPercent: 25,
		fractionalShareUnits: 2500,
		lifecycle: {
			phase: "initiated",
			status: "initiated",
			subState: "pending",
		},
		mortgageId: MORTGAGE_ID,
		nextAction: {
			disabledReason: null,
			event: "DEAL_LOCKED",
			label: "Lock Deal",
			payloadKind: "closing_date",
			requiresPayload: true,
			source: "governed_transition",
		},
		participants: {
			buyer: {
				accessRole: "lender",
				authId: "buyer_auth",
				displayName: "Buyer One",
				email: "buyer@example.com",
				lenderId: "lender_1" as Id<"lenders">,
				userId: "user_buyer" as Id<"users">,
			},
			fractionalShareStatus: {
				fractionalShareDisplayPercent: 25,
				fractionalShareUnits: 2500,
				isValid: true,
				validationError: null,
			},
			lawyer: {
				authId: "lawyer_auth",
				displayName: "Closing Lawyer",
				email: "lawyer@example.com",
				hasActiveDealAccess: true,
				lawyerType: "real_estate",
			},
			seller: {
				accessRole: "borrower",
				authId: "seller_auth",
				borrowerId: "borrower_1" as Id<"borrowers">,
				displayName: "Seller One",
				email: "seller@example.com",
				lenderId: null,
				userId: "user_seller" as Id<"users">,
			},
		},
		signing: {
			activeAttemptId: null,
			completedRequiredCount: 1,
			exceptionCount: 0,
			requiredCount: 2,
			status: "sent",
		},
		...overrides,
	};
}

function createProjection(): AdminDealOperationsProjection {
	const card = createCard();
	return {
		cards: [card],
		columns: {
			confirmed: [],
			documentReview: [],
			failed: [],
				fundsTransfer: [],
				initiated: [
					{
						_id: card._id,
						buyerId: card.participants.buyer.authId,
						closingDate: card.closingDate ?? undefined,
						createdAt: card.createdAt,
						createdBy: card.createdBy,
						fractionalShare: card.fractionalShareUnits,
						fractionalShareDisplayPercent:
							card.fractionalShareDisplayPercent,
						fractionalShareUnits: card.fractionalShareUnits,
						lawyerId: card.participants.lawyer.authId ?? undefined,
						lawyerType: card.participants.lawyer.lawyerType ?? undefined,
						mortgageId: card.mortgageId,
						sellerId: card.participants.seller.authId,
						status: card.lifecycle.status,
					},
				],
				lawyerOnboarding: [],
				unknown: [],
			},
		filters: {
			all: 1,
			awaiting_funds: 0,
			awaiting_signatures: 0,
			blocked: 1,
			completed: 0,
			failed: 0,
			needs_action: 1,
		},
	};
}

function createDetail(): AdminDealOperationsDetail {
	const card = createCard();
	return {
		access: {
			active: [
					{
						grantedAt: 1,
						role: "platform_lawyer",
						userId: "user_lawyer",
					},
				],
			revoked: [],
		},
		auditTimeline: [
			{
				eventId: "event_1",
				eventType: "DEAL_LOCKED",
				newState: "lawyerOnboarding.pending",
				outcome: "accepted",
				previousState: "initiated",
				reason: null,
				timestamp: 1,
			},
		],
		blockers: card.blockers,
		closeEvidence: {
			archives: [],
			effectOutcomes: [],
			funds: null,
		},
		deal: {
			closingDate: card.closingDate,
			createdAt: card.createdAt,
			dealId: card._id,
			fractionalShareDisplayPercent: card.fractionalShareDisplayPercent,
			fractionalShareUnits: card.fractionalShareUnits,
			lockingFeeAmount: 50_000,
			reservationId: null,
			status: card.lifecycle.status,
		},
		documentInstances: [],
		documentPackage: null,
		lifecycle: card.lifecycle,
			mortgage: {
				maturityDate: "2031-01-01",
				mortgageId: MORTGAGE_ID,
				paymentAmount: 2500,
				paymentFrequency: "monthly",
				principal: 500_000,
				status: "funded",
			},
		nextActions: [card.nextAction].filter(
			(action): action is NonNullable<typeof action> => action !== null
		),
		participants: card.participants,
			property: {
				city: "Toronto",
				propertyType: "residential",
				province: "ON",
				streetAddress: "123 King Street",
				unit: null,
			},
		signing: {
			activeAttemptId: null,
			attempts: [],
			exceptions: [],
			recipients: [
				{
					completedAt: 1,
					documensoRole: "SIGNER",
					name: "Buyer One",
					platformRole: "buyer",
					required: true,
					signingOrder: 1,
					signingStatus: "completed",
				},
				{
					completedAt: null,
					documensoRole: "SIGNER",
					name: "Seller One",
					platformRole: "seller",
					required: true,
					signingOrder: 2,
					signingStatus: "sent",
				},
			],
			status: "sent",
		},
	};
}

describe("deal operations components", () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it("renders the admin operations pipeline with server-projected cards", () => {
		useMutationMock.mockReturnValue(vi.fn(async () => ({ success: true })));
		useQueryMock.mockReturnValue(createProjection());

		render(<DealOperationsPipeline />);

		expect(screen.getByRole("heading", { name: "Deal Operations" })).not.toBeNull();
		expect(
			screen.getByText(
				"active and historical deal records projected from governed closing state.",
				{ exact: false }
			)
		).not.toBeNull();
		expect(
			screen.getByRole("button", { name: /needs action1/i })
		).not.toBeNull();
		expect(screen.getByText("Buyer One / Seller One")).not.toBeNull();
		expect(screen.getByText("Share 25%")).not.toBeNull();
		expect(screen.getByText("Signing 1/2")).not.toBeNull();
		expect(
			screen.getByText("Closing package has not been generated yet.")
		).not.toBeNull();
			expect(screen.getByLabelText("Open deal deal_1").getAttribute("href")).toBe(
				"/admin/deals/deal_1"
			);
	});

	it("renders the detail console without leaking signing tokens", () => {
		useMutationMock.mockReturnValue(vi.fn(async () => ({ success: true })));
		useQueryMock.mockReturnValue(createDetail());

		render(<DealOperationsConsole dealId={DEAL_ID} />);

		expect(screen.getByRole("heading", { name: "Deal deal_1" })).not.toBeNull();
		expect(screen.getByText("Lifecycle")).not.toBeNull();
		expect(screen.getByText("Blockers And Exceptions")).not.toBeNull();
		expect(screen.getByText("Buyer One (buyer@example.com)")).not.toBeNull();
		expect(screen.getByText("Package And Signing")).not.toBeNull();
		expect(screen.getByText("Required signers")).not.toBeNull();
		expect(screen.getByText("1/2")).not.toBeNull();
		expect(screen.getByText("Open portal")).not.toBeNull();
		expect(screen.queryByText(/token_/i)).toBeNull();
	});

	it("keeps cancellation submission disabled until a reason is entered", () => {
		useMutationMock.mockReturnValue(vi.fn(async () => ({ success: true })));

		render(
			<DealOperationActionControls
				actions={[
					{
						disabledReason: null,
						event: "DEAL_CANCELLED",
						label: "Cancel Deal",
						payloadKind: "cancel_reason",
						requiresPayload: true,
						source: "governed_transition",
					},
				]}
				dealId={DEAL_ID}
			/>
		);

		fireEvent.click(screen.getByRole("button", { name: "Cancel Deal" }));

		const submitButton = within(screen.getByRole("dialog")).getByRole("button", {
			name: "Cancel Deal",
		}) as HTMLButtonElement;
		expect(submitButton.disabled).toBe(true);

		fireEvent.change(screen.getByLabelText("Cancellation reason"), {
			target: { value: "Seller withdrew from closing." },
		});

		expect(submitButton.disabled).toBe(false);
	});
});
