/**
 * @vitest-environment jsdom
 */

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LawyerAssignedClosingsPage } from "#/components/lawyer/deals/LawyerAssignedClosingsPage";
import { LawyerDealWorkspacePage } from "#/components/lawyer/deals/LawyerDealWorkspacePage";

vi.mock("@tanstack/react-query", () => ({
	useQueryClient: vi.fn(),
}));

vi.mock("convex/react", () => ({
	useMutation: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual<typeof import("@tanstack/react-router")>(
		"@tanstack/react-router"
	);

	return {
		...actual,
		Link: (props: {
			children: ReactNode;
			className?: string;
			params?: Record<string, string>;
			to: string;
		}) => {
			const href = props.params
				? props.to.replace("$dealId", props.params.dealId ?? "")
				: props.to;
			return (
				<a className={props.className} href={href}>
					{props.children}
				</a>
			);
		},
	};
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

type AssignedMatters = ComponentProps<typeof LawyerAssignedClosingsPage>["matters"];
type Workspace = ComponentProps<typeof LawyerDealWorkspacePage>["workspace"];

const ASSIGNED_MATTERS_PLACEHOLDER_PARTICIPANTS = {
	buyer: {
		accessRole: "lender",
		authId: "buyer-auth",
		borrowerId: null,
		displayName: "Closed Buyer",
		email: "closed-buyer@test.fairlend.ca",
		lenderId: "lender_2" as never,
		userId: "user_closed_buyer" as never,
	},
	fractionalShareDisplayPercent: 10,
	fractionalShareStatus: {
		fractionalShareDisplayPercent: 10,
		fractionalShareUnits: 1000,
		isValid: true,
		validationError: null,
	},
	fractionalShareUnits: 1000,
	lawyer: {
		authId: "lawyer-auth",
		displayName: "Laura Lawyer",
		email: "lawyer@test.fairlend.ca",
		hasActiveDealAccess: false,
		lawyerType: "platform_lawyer",
	},
	personas: {
		admin: "admin-auth",
		buyer: "buyer-auth",
		lawyer: "lawyer-auth",
		seller: "seller-auth",
	},
	seller: {
		accessRole: "borrower",
		authId: "seller-auth",
		borrowerId: "borrower_2" as never,
		displayName: "Closed Seller",
		email: "closed-seller@test.fairlend.ca",
		lenderId: null,
		userId: "user_closed_seller" as never,
	},
};

const ASSIGNED_MATTERS: AssignedMatters = [
	{
		accessRole: "guest_lawyer",
		accessState: "active",
		bucket: "needsRepresentationConfirmation",
		closingDate: new Date("2026-05-15T12:00:00.000Z").getTime(),
		dealId: "deal_rep" as never,
		fractionalShareDisplayPercent: 25,
		fractionalShareUnits: 2500,
		lawyer: {
			authId: "lawyer-auth",
			displayName: "Laura Lawyer",
			email: "lawyer@test.fairlend.ca",
			hasActiveDealAccess: true,
			lawyerType: "guest_lawyer",
		},
		matterName: "Bianca Buyer / Sam Seller",
		participants: {
			buyer: {
				accessRole: "lender",
				authId: "buyer-auth",
				borrowerId: null,
				displayName: "Bianca Buyer",
				email: "buyer@test.fairlend.ca",
				lenderId: "lender_1" as never,
				userId: "user_buyer" as never,
			},
			dealId: "deal_rep" as never,
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
				admin: "admin-auth",
				buyer: "buyer-auth",
				lawyer: "lawyer-auth",
				seller: "seller-auth",
			},
			seller: {
				accessRole: "borrower",
				authId: "seller-auth",
				borrowerId: "borrower_1" as never,
				displayName: "Sam Seller",
				email: "seller@test.fairlend.ca",
				lenderId: null,
				userId: "user_seller" as never,
			},
		},
		status: "lawyerOnboarding.verified",
	},
	{
		accessRole: "platform_lawyer",
		accessState: "completed_read_only",
		bucket: "completed",
		closingDate: new Date("2026-04-01T12:00:00.000Z").getTime(),
		dealId: "deal_done" as never,
		fractionalShareDisplayPercent: 10,
		fractionalShareUnits: 1000,
		lawyer: null,
		matterName: "Closed Buyer / Closed Seller",
		participants: {
			...ASSIGNED_MATTERS_PLACEHOLDER_PARTICIPANTS,
			dealId: "deal_done" as never,
		},
		status: "confirmed",
	},
];

function createWorkspace(overrides?: Partial<Workspace>): Workspace {
	return {
		access: {
			accessRole: "guest_lawyer",
			accessState: "active",
		},
		deal: {
			closingDate: new Date("2026-05-15T12:00:00.000Z").getTime(),
			dealId: "deal_workspace" as never,
			fractionalShareDisplayPercent: 25,
			fractionalShareUnits: 2500,
			status: "documentReview.pending",
		},
		envelope: {
			attempts: [
				{
					active: true,
					attemptNumber: 1,
					createdAt: 10,
					dealDocumentInstanceId: "instance_1" as never,
					dealId: "deal_workspace" as never,
					exceptions: [],
					idempotencyKey: "attempt-1",
					packageId: "package_1" as never,
					provider: "documenso",
					recipientRoster: [],
					recipients: [
						{
							attemptId: "attempt_1" as never,
							completedAt: 30,
							createdAt: 11,
							dealDocumentInstanceId: "instance_1" as never,
							dealId: "deal_workspace" as never,
							documensoRole: "SIGNER",
							email: "buyer@test.fairlend.ca",
							name: "Bianca Buyer",
							packageId: "package_1" as never,
							platformRole: "lender_primary",
							readStatus: "opened",
							required: true,
							sendStatus: "sent",
							signingOrder: 1,
							signingStatus: "completed",
							tokenAvailable: false,
							tokenAvailableAt: undefined,
							tokenExpiresAt: undefined,
							updatedAt: 30,
						},
						{
							attemptId: "attempt_1" as never,
							createdAt: 12,
							dealDocumentInstanceId: "instance_1" as never,
							dealId: "deal_workspace" as never,
							documensoRole: "APPROVER",
							email: "lawyer@test.fairlend.ca",
							name: "Laura Lawyer",
							packageId: "package_1" as never,
							platformRole: "lawyer_primary",
							readStatus: "available",
							required: true,
							sendStatus: "sent",
							signingOrder: 2,
							signingStatus: "not_started",
							tokenAvailable: true,
							tokenAvailableAt: 12,
							tokenExpiresAt: new Date("2026-06-01T12:00:00.000Z").getTime(),
							updatedAt: 12,
						},
					],
					status: "partially_signed",
					updatedAt: 10,
				},
			],
			exceptions: [],
		},
		matterOverview: {
			mortgage: {
				interestRate: 9.5,
				maturityDate: "2031-01-01",
				mortgageId: "mortgage_1" as never,
				paymentAmount: 2500,
				paymentFrequency: "monthly",
				principal: 500_000,
				status: "funded",
			},
			participants: ASSIGNED_MATTERS[0].participants,
			property: {
				city: "Toronto",
				propertyType: "residential",
				province: "ON",
				streetAddress: "123 King St W",
				unit: null,
			},
		},
		packageReview: {
			approval: {
				blockers: [],
				eligible: true,
			},
			instances: [
				{
					class: "private_templated_signable",
					displayName: "Closing Signature Package",
					instanceId: "instance_1" as never,
					kind: "generated",
					packageLabel: "Closing",
					signingState: null,
					status: "signature_draft",
					url: null,
				},
			],
			package: {
				readyAt: 1,
				status: "ready",
			},
		},
		readOnly: false,
		timeline: {
			legalActions: [
				{
					at: 20,
					description: "Representation confirmed.",
					eventType: "REPRESENTATION_CONFIRMED",
					outcome: "transitioned",
					title: "REPRESENTATION_CONFIRMED",
				},
			],
		},
		...overrides,
	};
}

describe("lawyer workspace pages", () => {
	it("groups assigned closings and links to the deal workspace", () => {
		render(<LawyerAssignedClosingsPage matters={ASSIGNED_MATTERS} />);

		expect(screen.getByText("Assigned Closings")).toBeTruthy();
		expect(screen.getByText("Needs Representation Confirmation")).toBeTruthy();
		expect(screen.getByText("Completed")).toBeTruthy();
		expect(screen.getByText("Bianca Buyer / Sam Seller")).toBeTruthy();
		expect(screen.getByText("Closed Buyer / Closed Seller")).toBeTruthy();
		expect(
			screen.getAllByRole("link", { name: /Open/ })[0]?.getAttribute("href")
		).toBe("/lawyer/deals/deal_rep");
	});

	it("renders package, signer, and timeline surfaces and runs package approval", async () => {
		const approveDocuments = vi.fn().mockResolvedValue({ success: true });
		const invalidateQueries = vi.fn().mockResolvedValue(undefined);
		vi.mocked(useMutation)
			.mockReturnValueOnce(vi.fn())
			.mockReturnValueOnce(approveDocuments);
		vi.mocked(useQueryClient).mockReturnValue({
			invalidateQueries,
		} as never);

		render(<LawyerDealWorkspacePage workspace={createWorkspace()} />);

		expect(screen.getByText("Bianca Buyer / Sam Seller")).toBeTruthy();
		fireEvent.click(screen.getByRole("tab", { name: "Package Review" }));
		expect(screen.getByText("Closing Signature Package")).toBeTruthy();

		fireEvent.click(screen.getByRole("tab", { name: "Signers" }));
		expect(screen.getByText("Signing in progress")).toBeTruthy();

		fireEvent.click(screen.getByRole("tab", { name: "Timeline" }));
		expect(screen.getByText("Representation confirmed.")).toBeTruthy();

		fireEvent.click(
			screen.getByRole("button", { name: "Approve Package For Signing" })
		);

		expect(approveDocuments).toHaveBeenCalledWith({
			dealId: "deal_workspace",
		});
		await waitFor(() => expect(invalidateQueries).toHaveBeenCalled());
	});

	it("disables actions for completed read-only workspace access", () => {
		vi.mocked(useMutation).mockReturnValue(vi.fn());
		vi.mocked(useQueryClient).mockReturnValue({
			invalidateQueries: vi.fn(),
		} as never);

		render(
			<LawyerDealWorkspacePage
				workspace={createWorkspace({
					access: {
						accessRole: "guest_lawyer",
						accessState: "completed_read_only",
					},
					deal: {
						...createWorkspace().deal,
						status: "confirmed",
					},
					readOnly: true,
				})}
			/>
		);

		expect(screen.getByText("Read-only")).toBeTruthy();
		expect(
			(screen.getByRole("button", {
				name: "Confirm Representation",
			}) as HTMLButtonElement).disabled
		).toBe(true);
		expect(
			(screen.getByRole("button", {
				name: "Approve Package For Signing",
			}) as HTMLButtonElement).disabled
		).toBe(true);
	});
});
