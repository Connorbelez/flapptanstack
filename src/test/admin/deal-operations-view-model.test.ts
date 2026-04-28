import { describe, expect, it } from "vitest";
import type { AdminDealOperationsCard } from "../../../convex/deals/queries";
import {
	actionDisabledReason,
	filterDealOperationCards,
	formatDealOperationPhase,
	formatDealShare,
	groupDealOperationCards,
	lifecycleProgress,
	primaryActionLabel,
	summarizeBlockers,
} from "#/components/admin/deals/dealOperationsViewModel";

function card(
	id: string,
	phase: AdminDealOperationsCard["lifecycle"]["phase"],
	filters: AdminDealOperationsCard["filters"]
): AdminDealOperationsCard {
		return {
			_id: id as AdminDealOperationsCard["_id"],
			actions: [],
			blockers: [],
		closingDate: null,
		closingTeam: [],
		createdAt: 1,
		createdBy: "user_1",
		filters,
		fractionalShareDisplayPercent: 25,
		fractionalShareUnits: 2500,
		lifecycle: {
			phase,
			status: phase === "initiated" ? "initiated" : `${phase}.pending`,
			subState: "pending",
		},
		mortgageId: "mortgage_1" as AdminDealOperationsCard["mortgageId"],
		nextAction: null,
		participants: {
			buyer: {
				accessRole: "lender",
				authId: "buyer_auth",
				displayName: "Buyer One",
				email: "buyer@example.com",
				lenderId: null,
				userId: null,
			},
			fractionalShareStatus: {
				fractionalShareDisplayPercent: 25,
				fractionalShareUnits: 2500,
				isValid: true,
				validationError: null,
			},
			lawyer: {
				authId: null,
				displayName: null,
				email: null,
				hasActiveDealAccess: false,
				lawyerType: null,
			},
			seller: {
				accessRole: "borrower",
				authId: "seller_auth",
				borrowerId: null,
				displayName: "Seller One",
				email: "seller@example.com",
				lenderId: null,
				userId: null,
			},
		},
		signing: {
			activeAttemptId: null,
			completedRequiredCount: 0,
			exceptionCount: 0,
			requiredCount: 0,
			status: "not_started",
		},
	};
}

describe("dealOperationsViewModel", () => {
	it("filters cards by operational bucket", () => {
		const cards = [
			card("deal_1", "initiated", ["all", "needs_action"]),
			card("deal_2", "documentReview", [
				"all",
				"blocked",
				"awaiting_signatures",
			]),
		];

		expect(filterDealOperationCards(cards, "all")).toHaveLength(2);
		expect(filterDealOperationCards(cards, "blocked")).toEqual([cards[1]]);
		expect(filterDealOperationCards(cards, "awaiting_funds")).toEqual([]);
	});

	it("groups cards by lifecycle phase", () => {
		const grouped = groupDealOperationCards([
			card("deal_1", "initiated", ["all"]),
			card("deal_2", "confirmed", ["all", "completed"]),
		]);

		expect(grouped.initiated).toHaveLength(1);
		expect(grouped.confirmed).toHaveLength(1);
		expect(grouped.failed).toHaveLength(0);
	});

	it("formats lifecycle and share display from projected values", () => {
		expect(formatDealOperationPhase("documentReview.signed", "signed")).toBe(
			"Document Review - Signed"
		);
		expect(formatDealShare(25)).toBe("25%");
		expect(formatDealShare(12.5)).toBe("12.5%");
		expect(formatDealShare(null)).toBe("Invalid share");
	});

	it("summarizes blockers and action requirements", () => {
		expect(summarizeBlockers([])).toBe("No blockers");
		expect(
			summarizeBlockers([
				{
					kind: "package_failed",
					message: "Package failed",
					severity: "critical",
				},
			])
		).toBe("1 critical blocker");
		expect(primaryActionLabel(null)).toBe("Monitor");
		expect(
			actionDisabledReason({
				disabledReason: null,
				event: "DEAL_LOCKED",
				label: "Lock Deal",
				payloadKind: "closing_date",
				requiresPayload: true,
				source: "governed_transition",
			})
		).toBe("Closing date required");
	});

	it("computes lifecycle rail progress without treating failed as normal completion", () => {
		expect(lifecycleProgress("documentReview")).toEqual({
			completed: ["initiated", "lawyerOnboarding"],
			current: "documentReview",
			remaining: ["fundsTransfer", "confirmed"],
		});
		expect(lifecycleProgress("failed")).toEqual({
			completed: [],
			current: "failed",
			remaining: [],
		});
	});
});
