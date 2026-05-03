/**
 * @vitest-environment jsdom
 */

import {
	cleanup,
	fireEvent,
	render,
	within,
} from "@testing-library/react";
import { useMutation, useQuery } from "convex/react";
import { Window } from "happy-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminLawyersPage } from "#/components/admin/lawyers/AdminLawyersPage";
import {
	formatLawyerUrgencyLabel,
	getLawyerRosterFilterFromSummaryCard,
} from "#/components/admin/lawyers/admin-lawyers-model";

vi.mock("convex/react", () => ({
	useMutation: vi.fn(),
	useQuery: vi.fn(),
}));

const useQueryMock = useQuery as unknown as ReturnType<typeof vi.fn>;
const useMutationMock = useMutation as unknown as ReturnType<typeof vi.fn>;
let testWindow: Window | null = null;

beforeEach(() => {
	testWindow = new Window({ url: "http://admin.localhost:3000/admin/lawyers" });
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: testWindow,
	});
	Object.defineProperty(globalThis, "document", {
		configurable: true,
		value: testWindow.document,
	});
	Object.defineProperty(globalThis, "navigator", {
		configurable: true,
		value: testWindow.navigator,
	});
	Object.defineProperty(globalThis, "HTMLElement", {
		configurable: true,
		value: testWindow.HTMLElement,
	});
	Object.defineProperty(globalThis, "Element", {
		configurable: true,
		value: testWindow.Element,
	});
	Object.defineProperty(globalThis, "Node", {
		configurable: true,
		value: testWindow.Node,
	});
	Object.defineProperty(testWindow, "SyntaxError", {
		configurable: true,
		value: SyntaxError,
	});
});

afterEach(() => {
	cleanup();
	void testWindow?.happyDOM.abort();
	testWindow = null;
	vi.clearAllMocks();
});

function rosterFixture() {
	return {
		nextCursor: null,
		rows: [
			{
				activeInvitation: {
					dealId: "deal_1",
					deliveryStatus: "sent",
					expiresAt: Date.UTC(2026, 4, 4),
					invitationId: "invitation_1",
					status: "pending",
					targetEmail: "guest@example.test",
					updatedAt: Date.UTC(2026, 4, 3),
				},
				activeDealCount: 1,
				barNumber: "LSO-200002",
				capacityLimit: 3,
				capacityWarning: null,
				displayName: "Guest Lawyer",
				email: "guest@example.test",
				firmName: "Guest Law",
				invitationStatus: "pending",
				latestActivityAt: Date.UTC(2026, 4, 3),
				nextAction: "Resend or cancel invitation",
				platformStatus: "not_platform",
				profileId: "lawyerProfile_guest",
				profileKind: "guest",
				jurisdiction: "ON",
				latestVerification: null,
				restrictionRecheckStatus: "none",
				slaStatus: "none",
				urgency: "invitation_expiring",
				verificationStatus: "not_verified",
			},
		],
		summary: {
			atCapacity: 0,
			invitationsExpiring: 1,
			needsAction: 1,
			restrictionRecheckDue: 0,
			slaBreached: 0,
			verificationReview: 0,
		},
		totalCount: 1,
	};
}

function detailFixture() {
	return {
		allowedActions: {
			cancelInvitation: true,
			replaceLawyer: true,
			resendInvitation: true,
			verifyRepresentation: true,
		},
		deals: {
			active: [
				{
					_id: "deal_1",
					lawyerType: "guest_lawyer",
					selectedLawyer: {
						email: "guest@example.test",
						firm: "Guest Law",
						name: "Guest Lawyer",
						source: "manual",
						type: "guest_lawyer",
					},
					status: "lawyerOnboarding.pending",
				},
			],
			recent: [],
		},
		invitations: {
			active: [{ _id: "invitation_1", dealId: "deal_1", status: "pending" }],
			historical: [],
		},
		profile: {
			_id: "lawyerProfile_guest",
			barNumber: "LSO-200002",
			displayName: "Guest Lawyer",
			email: "guest@example.test",
			firmName: "Guest Law",
			jurisdiction: "ON",
			profileKind: "guest",
		},
		platform: {
			assignment: null,
			availability: { exceptions: [], windows: [] },
			escalations: [],
			metrics: null,
			restrictionRecheck: null,
			slaReview: null,
		},
		activity: {
			events: [
				{
					at: Date.UTC(2026, 4, 3),
					entityId: "lawyerProfile_guest",
					kind: "profile_updated",
					label: "Profile updated",
				},
			],
			latestActivityAt: Date.UTC(2026, 4, 3),
		},
		representation: {
			engagements: [],
			overrideEvidence: [],
		},
		verifications: [],
	};
}

function mockRoster() {
	useQueryMock.mockImplementation((_reference, args) => {
		if (args === "skip") {
			return undefined;
		}
		if (args && "email" in args) {
			return {
				normalizedEmail: "existing@example.test",
				profile: null,
				recommendedAction: "attach_existing_user",
				user: {
					authId: "user_existing_lawyer",
					displayName: "Existing Lawyer",
					email: "existing@example.test",
					userId: "user_existing_lawyer_id",
				},
			};
		}
		if (args && "profileId" in args) {
			return detailFixture();
		}
		return rosterFixture();
	});
	useMutationMock.mockReturnValue(vi.fn());
}

describe("admin lawyers presentation model", () => {
	it("formats urgency labels for scan-friendly roster cells", () => {
		expect(formatLawyerUrgencyLabel("invitation_expiring")).toBe(
			"Invitation expiring"
		);
		expect(formatLawyerUrgencyLabel("normal")).toBe("Normal");
	});

	it("maps operational summary cards to roster filters", () => {
		expect(getLawyerRosterFilterFromSummaryCard("verificationReview")).toEqual({
			profileKind: "all",
			urgency: "verification_requires_review",
		});
	});
});

describe("AdminLawyersPage", () => {
	it("renders operational summary and bounded paginated roster", () => {
		mockRoster();
		const view = render(<AdminLawyersPage />);

		expect(
			view.getByRole("heading", { name: "Lawyer Operations" })
		).toBeTruthy();
		expect(
			view.getByRole("button", { name: /Invitations expiring 1/ })
		).toBeTruthy();
		const tableRegion = view.getByTestId("admin-lawyers-roster-region");
		expect(tableRegion.className).toContain("max-h");
		expect(within(tableRegion).getByText("Guest Lawyer")).toBeTruthy();
		expect(within(tableRegion).getByText("Guest Law")).toBeTruthy();
		expect(within(tableRegion).getByText("LSO-200002 / ON")).toBeTruthy();
		expect(within(tableRegion).getByText("Not platform")).toBeTruthy();
		expect(within(tableRegion).getByText("Pending")).toBeTruthy();
		expect(view.getByText("Page 1")).toBeTruthy();
	});

	it("renders all required roster toolbar controls", () => {
		mockRoster();
		const view = render(<AdminLawyersPage />);

		expect(view.getByLabelText("Search lawyers")).toBeTruthy();
		expect(view.getByLabelText("Profile kind")).toBeTruthy();
		expect(view.getByLabelText("Platform status")).toBeTruthy();
		expect(view.getByLabelText("Urgency")).toBeTruthy();
		expect(view.getByLabelText("Verification")).toBeTruthy();
		expect(view.getByLabelText("Invitation")).toBeTruthy();
		expect(view.getByLabelText("Sort")).toBeTruthy();
	});

	it("tracks previous pagination cursors instead of resetting to the first page", () => {
		useQueryMock.mockImplementation((_reference, args) => {
			if (args === "skip" || (args && "profileId" in args)) {
				return args === "skip" ? undefined : detailFixture();
			}
			const cursor = args?.pagination?.cursor ?? null;
			return {
				...rosterFixture(),
				nextCursor: cursor === null ? 25 : cursor === 25 ? 50 : null,
				rows: [
					{
						...rosterFixture().rows[0],
						displayName: cursor === null ? "Page One" : "Page Two",
					},
				],
			};
		});
		useMutationMock.mockReturnValue(vi.fn());
		const view = render(<AdminLawyersPage />);

		fireEvent.click(view.getByRole("button", { name: "Next page" }));
		fireEvent.click(view.getByRole("button", { name: "Next page" }));
		fireEvent.click(view.getByRole("button", { name: "Previous page" }));

		const rosterCalls = useQueryMock.mock.calls.filter(
			([, args]) =>
				typeof args === "object" && args !== null && "pagination" in args
		);
		expect(rosterCalls.at(-1)?.[1].pagination.cursor).toBe(25);
	});

	it("opens the detail sheet from a row click", () => {
		mockRoster();
		const view = render(<AdminLawyersPage />);

		fireEvent.click(view.getByRole("button", { name: /Open Guest Lawyer/ }));

		expect(
			view.getByRole("dialog", { name: "Guest Lawyer" })
		).toBeTruthy();
		expect(view.getByText("Overview")).toBeTruthy();
		expect(view.getByText("Operational Work")).toBeTruthy();
		expect(view.getByText("Platform Ops")).toBeTruthy();
		expect(view.getByText("Audit / Activity")).toBeTruthy();
	});

	it("wires item-scoped detail actions to canonical mutations", () => {
		const mutation = vi.fn();
		mockRoster();
		useMutationMock.mockReturnValue(mutation);
		const view = render(<AdminLawyersPage />);

		fireEvent.click(view.getByRole("button", { name: /Open Guest Lawyer/ }));
		fireEvent.click(view.getByRole("button", { name: "Resend invitation" }));
		fireEvent.click(view.getByRole("button", { name: "Cancel invitation" }));
		fireEvent.click(view.getByRole("button", { name: "Verify representation" }));
		fireEvent.input(view.getByLabelText("Verification evidence note"), {
			target: { value: "Signed engagement reviewed." },
		});
		fireEvent.click(view.getByRole("button", { name: "Submit verification" }));

		expect(mutation).toHaveBeenCalledWith({ dealId: "deal_1" });
		expect(mutation).toHaveBeenCalledWith({ invitationId: "invitation_1" });
		expect(mutation).toHaveBeenCalledWith({
			attachmentIds: [],
			dealId: "deal_1",
			evidenceNote: "Signed engagement reviewed.",
			reason: "Admin verified representation from lawyer operations detail sheet",
		});
	});

	it("blocks representation override without evidence text", () => {
		const mutation = vi.fn();
		mockRoster();
		useMutationMock.mockReturnValue(mutation);
		const view = render(<AdminLawyersPage />);

		fireEvent.click(view.getByRole("button", { name: /Open Guest Lawyer/ }));
		fireEvent.click(view.getByRole("button", { name: "Override representation" }));
		fireEvent.click(view.getByRole("button", { name: "Submit override" }));

		expect(view.getByText("Evidence note is required.")).toBeTruthy();
		expect(mutation).not.toHaveBeenCalled();
	});

	it("opens the platform lawyer invitation dialog", () => {
		mockRoster();
		const view = render(<AdminLawyersPage />);

		fireEvent.click(view.getByRole("button", { name: "Invite platform lawyer" }));

		expect(
			view.getByRole("dialog", { name: "Invite platform lawyer" })
		).toBeTruthy();
		expect(view.getByLabelText("Email")).toBeTruthy();
	});

	it("resolves platform lawyer invites before attach or pending invite submission", () => {
		const mutation = vi.fn();
		mockRoster();
		useMutationMock.mockReturnValue(mutation);
		const view = render(<AdminLawyersPage />);

		fireEvent.click(view.getByRole("button", { name: "Invite platform lawyer" }));
		fireEvent.input(view.getByLabelText("Email"), {
			target: { value: "existing@example.test" },
		});
		fireEvent.input(view.getByLabelText("Name"), {
			target: { value: "Existing Lawyer" },
		});
		fireEvent.input(view.getByLabelText("Bar number"), {
			target: { value: "LSO-123456" },
		});
		fireEvent.input(view.getByLabelText("Jurisdiction"), {
			target: { value: "ON" },
		});

		expect(view.getByText("Existing WorkOS user")).toBeTruthy();
		fireEvent.click(view.getByRole("button", { name: "Attach user" }));

		expect(mutation).toHaveBeenCalledWith({
			authId: "user_existing_lawyer",
			barNumber: "LSO-123456",
			displayName: "Existing Lawyer",
			email: "existing@example.test",
			firmName: undefined,
			jurisdiction: "ON",
			resolution: "attach_existing_user",
		});
	});
});
