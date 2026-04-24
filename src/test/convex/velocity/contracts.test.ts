import { describe, expect, it } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
	VELOCITY_ACTIVATION_STATUS_CODE,
	VELOCITY_DEAL_STATUS,
	VELOCITY_PACKAGE_AUDIT_EVENT_TYPES,
	VELOCITY_WORKFLOW_SOURCE_TYPE,
	buildVelocityActivationIdempotencyKey,
	buildVelocityMortgageActivationSource,
	buildVelocityMortgageWorkflowSourceKey,
	buildVelocitySyncIdempotencyKey,
	buildVelocityWebhookEventIdempotencyKey,
	isUnsupportedVelocityPaymentFrequency,
	mapVelocityPaymentFrequencyToFairLend,
	resolveVelocityStatusSemantics,
	velocityFairLendEnrichmentValidator,
	velocityNormalizedCoreValidator,
	velocityPackageWorkspaceStateValidator,
	type VelocityActivationHandoffV1,
	type VelocityActivationAttemptRecordV1,
	type VelocitySyncAttemptRecordV1,
	type VelocityWebhookEventRecordV1,
} from "../../../../convex/velocity";

describe("Velocity package contracts", () => {
	it("pins v1 Velocity status semantics", () => {
		expect(VELOCITY_DEAL_STATUS[6]).toBe("Funded");
		expect(VELOCITY_ACTIVATION_STATUS_CODE).toBe(6);

		expect(resolveVelocityStatusSemantics({ statusCode: 6 })).toEqual({
			canActivate: true,
			disposition: "activation_eligible",
			statusCode: 6,
			statusLabel: "Funded",
		});

		expect(resolveVelocityStatusSemantics({ statusCode: 7 })).toMatchObject({
			blockerCode: "velocity_complete_before_activation",
			canActivate: false,
			disposition: "complete_before_activation_remediation",
			statusLabel: "Complete",
		});

		expect(resolveVelocityStatusSemantics({ statusCode: 8 })).toMatchObject({
			blockerCode: "unsupported_velocity_status",
			canActivate: false,
			disposition: "non_actionable",
			statusLabel: "Parked",
		});
	});

	it("maps only supported Velocity payment frequencies", () => {
		expect(mapVelocityPaymentFrequencyToFairLend(1)).toBe("bi_weekly");
		expect(mapVelocityPaymentFrequencyToFairLend(2)).toBe(
			"accelerated_bi_weekly"
		);
		expect(mapVelocityPaymentFrequencyToFairLend(3)).toBe("monthly");
		expect(mapVelocityPaymentFrequencyToFairLend(5)).toBe("weekly");

		expect(mapVelocityPaymentFrequencyToFairLend(4)).toBeNull();
		expect(mapVelocityPaymentFrequencyToFairLend(6)).toBeNull();
		expect(isUnsupportedVelocityPaymentFrequency(4)).toBe(true);
		expect(isUnsupportedVelocityPaymentFrequency(6)).toBe(true);
	});

	it("builds canonical workflow and idempotency keys", () => {
		expect(buildVelocityMortgageWorkflowSourceKey("link-app-123")).toBe(
			"velocity_package:mortgage:link-app-123"
		);
		expect(
			buildVelocityWebhookEventIdempotencyKey({
				eventTimestamp: "2026-04-23T15:00:00.000Z",
				eventType: 10,
				loanCode: "LC-123",
				status: 6,
			})
		).toBe("velocity:webhook:LC-123:2026-04-23T15%3A00%3A00.000Z:10:6");
		expect(
			buildVelocitySyncIdempotencyKey({
				linkApplicationId: "link-app-123",
				rawDealHash: "raw-hash",
			})
		).toBe("velocity:sync:link-app-123:raw-hash");
		expect(
			buildVelocityActivationIdempotencyKey({
				reviewedSnapshotHash: "reviewed-hash",
				workspaceId: "workspace-123",
			})
		).toBe("velocity:activation:workspace-123:reviewed-hash");
	});

	it("builds Velocity mortgage activation provenance", () => {
		const source = buildVelocityMortgageActivationSource({
			linkApplicationId: "link-app-123",
			viewerUserId: "user-123" as Id<"users">,
			workspaceId: "workspace-123" as Id<"velocityPackageWorkspaces">,
		});

		expect(source).toEqual({
			creationSource: "velocity_package",
			originatedByUserId: "user-123",
			originatingWorkflowId: "workspace-123",
			originatingWorkflowType: VELOCITY_WORKFLOW_SOURCE_TYPE,
			originationPath: "velocity",
			workflowSourceId: "workspace-123",
			workflowSourceKey: "velocity_package:mortgage:link-app-123",
			workflowSourceType: VELOCITY_WORKFLOW_SOURCE_TYPE,
		});
	});

	it("exports validator and audit surfaces from the single Velocity namespace", () => {
		expect(velocityPackageWorkspaceStateValidator).toBeDefined();
		expect(velocityNormalizedCoreValidator).toBeDefined();
		expect(velocityFairLendEnrichmentValidator).toBeDefined();
		expect(VELOCITY_PACKAGE_AUDIT_EVENT_TYPES).toContain(
			"velocity_webhook_provenance_recorded"
		);
	});

	it("models package-owned activation remediation and handoff fields", () => {
		const handoff = {
			activationAttemptId: "activation-123" as Id<"velocityActivationAttempts">,
			actorAuthId: "user_auth_123",
			actorType: "admin",
			borrowerLinks: [
				{
					borrowerId: "borrower-123" as Id<"borrowers">,
					role: "primary",
				},
			],
			brokerOfRecordId: "broker-123" as Id<"brokers">,
			collectionsDraft: {
				activationStatus: "pending",
				mode: "provider_managed_now",
				padAuthorizationAssetId: "asset-123" as Id<"documentAssets">,
				padAuthorizationSource: "uploaded",
				providerCode: "pad_rotessa",
			},
			mortgageDraft: {
				amortizationMonths: 300,
				firstPaymentDate: "2026-06-01",
				interestAdjustmentDate: "2026-05-01",
				interestRate: 8.25,
				lienPosition: 1,
				loanType: "conventional",
				maturityDate: "2027-05-01",
				paymentAmount: 1250,
				paymentFrequency: "monthly",
				principal: 250_000,
				rateType: "fixed",
				termMonths: 12,
				termStartDate: "2026-05-01",
			},
			propertyDraft: {
				create: {
					city: "Toronto",
					postalCode: "M5V 1A1",
					propertyType: "residential",
					province: "ON",
					streetAddress: "123 King St W",
				},
			},
			reviewedSnapshotHash: "normalized-hash",
			reviewedSnapshotId: "snapshot-123" as Id<"velocityPackageSnapshots">,
			source: {
				creationSource: "velocity_package",
				originatedByUserId: "user-123",
				originatingWorkflowId: "workspace-123",
				originatingWorkflowType: "velocity_package",
				originationPath: "velocity",
				workflowSourceId: "workspace-123",
				workflowSourceKey: "velocity_package:mortgage:link-app-123",
				workflowSourceType: "velocity_package",
			},
			viewerUserId: "user-123" as Id<"users">,
		} satisfies VelocityActivationHandoffV1;

		expect(handoff.mortgageDraft.loanType).toBe("conventional");
		expect(handoff.mortgageDraft.lienPosition).toBe(1);
		expect(handoff.collectionsDraft.padAuthorizationSource).toBe("uploaded");
	});

	it("keeps exported record contracts aligned with schema provenance fields", () => {
		const webhookEvent = {
			attempts: 1,
			dealHref: "https://velocity.example/deals/LC-123",
			provider: "velocity",
			providerEventId: "velocity:webhook:LC-123",
			rawBody: "{}",
			receivedAt: 1_776_000_000_000,
			signatureVerified: true,
			status: "pending",
		} satisfies VelocityWebhookEventRecordV1;

		const syncAttempt = {
			idempotencyKey: "velocity:sync:link-app-123:raw-hash",
			request: { linkApplicationId: "link-app-123" },
			result: "succeeded",
			startedAt: 1_776_000_000_000,
			trigger: "manual_sync_now",
		} satisfies VelocitySyncAttemptRecordV1;

		const activationAttempt = {
			actorAuthId: "user_auth_123",
			actorUserId: "user-123" as Id<"users">,
			idempotencyKey: "velocity:activation:workspace-123:reviewed-hash",
			listingId: "listing-123" as Id<"listings">,
			reviewedSnapshotHash: "reviewed-hash",
			reviewedSnapshotId: "snapshot-123" as Id<"velocityPackageSnapshots">,
			startedAt: 1_776_000_000_000,
			status: "queued",
			workspaceId: "workspace-123" as Id<"velocityPackageWorkspaces">,
		} satisfies VelocityActivationAttemptRecordV1;

		expect(webhookEvent.dealHref).toContain("LC-123");
		expect(syncAttempt.idempotencyKey).toBe("velocity:sync:link-app-123:raw-hash");
		expect(activationAttempt.listingId).toBe("listing-123");
	});
});
