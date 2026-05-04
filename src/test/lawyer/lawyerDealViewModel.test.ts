import { describe, expect, it } from "vitest";
import {
	buildLawyerActionStates,
	buildLawyerTimeline,
	groupLawyerMatters,
	packageApprovalBlockers,
	summarizeLawyerSigners,
} from "#/components/lawyer/deals/lawyerDealViewModel";

describe("lawyer deal view model", () => {
	it("groups assigned matters into the required lawyer buckets", () => {
		const grouped = groupLawyerMatters([
			{
				accessState: "active",
				closingDate: 40,
				dealId: "deal_signing",
				status: "documentReview.signed",
			},
			{
				accessState: "active",
				closingDate: 10,
				dealId: "deal_representation",
				status: "lawyerOnboarding.verified",
			},
			{
				accessState: "completed_read_only",
				closingDate: 5,
				dealId: "deal_complete",
				status: "confirmed",
			},
			{
				accessState: "active",
				closingDate: 20,
				dealId: "deal_package",
				status: "documentReview.pending",
			},
		]);

		expect(grouped.needsRepresentationConfirmation.map((item) => item.dealId)).toEqual([
			"deal_representation",
		]);
		expect(grouped.needsPackageReview.map((item) => item.dealId)).toEqual([
			"deal_package",
		]);
		expect(grouped.awaitingSigners.map((item) => item.dealId)).toEqual([
			"deal_signing",
		]);
		expect(grouped.completed.map((item) => item.dealId)).toEqual([
			"deal_complete",
		]);
	});

	it("enables representation only for active lawyers in the verified state", () => {
		const actions = buildLawyerActionStates({
			accessState: "active",
			status: "lawyerOnboarding.verified",
			packageReview: {
				instances: [],
				openExceptions: [],
				packageStatus: null,
			},
		});

		expect(actions.confirmRepresentation).toMatchObject({
			enabled: true,
			disabledReason: null,
		});
		expect(actions.approvePackageForSigning.enabled).toBe(false);

		const readOnlyActions = buildLawyerActionStates({
			accessState: "access_ended",
			status: "lawyerOnboarding.verified",
			packageReview: {
				instances: [],
				openExceptions: [],
				packageStatus: null,
			},
		});

		expect(readOnlyActions.confirmRepresentation).toMatchObject({
			enabled: false,
			disabledReason: "Your active lawyer access for this matter has ended.",
		});
	});

	it("uses legal gate reasons for representation confirmation blockers", () => {
		const actions = buildLawyerActionStates({
			accessState: "active",
			status: "lawyerOnboarding.verified",
			packageReview: {
				instances: [],
				openExceptions: [],
				packageStatus: null,
			},
			representationGate: {
				decision: "block",
				message: "Signed representation engagement evidence is required.",
				reasonCodes: ["engagement_missing"],
			},
		});

		expect(actions.confirmRepresentation).toMatchObject({
			enabled: false,
			disabledReason: "Signed representation engagement evidence is required.",
		});
	});

	it("blocks package approval until package, signatory, and pre-send requirements pass", () => {
		const blockers = packageApprovalBlockers({
			packageStatus: "ready",
			instances: [
				{
					class: "private_templated_signable",
					displayName: "Closing package",
					signingState: "pending_recipient_resolution",
					status: "signature_pending_recipient_resolution",
				},
			],
			openExceptions: [
				{
					kind: "pre_send_configuration_failure",
					severity: "blocking",
					status: "open",
				},
			],
		});

		expect(blockers).toEqual([
			"Signatory mappings are incomplete.",
			"Open pre-send configuration exceptions must be resolved.",
		]);

		const actions = buildLawyerActionStates({
			accessState: "active",
			status: "documentReview.pending",
			packageReview: {
				packageStatus: "ready",
				instances: [
					{
						class: "private_templated_signable",
						displayName: "Closing package",
						signingState: "draft",
						status: "signature_draft",
					},
				],
				openExceptions: [],
			},
		});

		expect(actions.approvePackageForSigning).toMatchObject({
			enabled: true,
			disabledReason: null,
		});
	});

	it("summarizes signer progress without exposing a local signing model", () => {
		const summary = summarizeLawyerSigners({
			attempts: [
				{
					attemptNumber: 1,
					createdAt: 100,
					status: "voided",
					supersededByAttemptId: "attempt_2",
					recipients: [],
				},
				{
					attemptNumber: 2,
					createdAt: 200,
					status: "partially_signed",
					supersedesAttemptId: "attempt_1",
					recipients: [
						{
							completedAt: 300,
							name: "Lena Lender",
							platformRole: "lender_primary",
							required: true,
							signingOrder: 1,
							signingStatus: "completed",
						},
						{
							name: "Laura Lawyer",
							platformRole: "lawyer_primary",
							required: true,
							signingOrder: 2,
							signingStatus: "not_started",
						},
					],
				},
			],
			exceptions: [],
		});

		expect(summary).toEqual({
			completedRequiredCount: 1,
			hasOpenBlockingException: false,
			hasReissueHistory: true,
			nextSignerNames: ["Laura Lawyer"],
			requiredCount: 2,
			statusLabel: "Signing in progress",
		});
	});

	it("builds a unified chronological timeline from legal, signer, exception, and close events", () => {
		const timeline = buildLawyerTimeline({
			legalActions: [
				{
					at: 100,
					description: "Representation confirmed",
					title: "Representation confirmed",
					type: "legal_action",
				},
			],
			attempts: [
				{
					attemptNumber: 1,
					createdAt: 150,
					status: "completed",
					recipients: [
						{
							completedAt: 300,
							documensoRole: "SIGNER",
							name: "Lena Lender",
							platformRole: "lender_primary",
							required: true,
							signingOrder: 1,
							signingStatus: "completed",
						},
					],
				},
			],
			exceptions: [
				{
					createdAt: 250,
					kind: "recipient_rejection",
					message: "Recipient rejected an earlier attempt",
					status: "resolved",
				},
			],
			closeMilestones: [
				{
					at: 400,
					description: "Deal close confirmed",
					title: "Close complete",
					type: "close",
				},
			],
		});

		expect(timeline.map((event) => event.type)).toEqual([
			"legal_action",
			"document_exception",
			"signer_progress",
			"close",
		]);
	});
});
