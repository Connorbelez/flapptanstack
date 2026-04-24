import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type {
	VelocityConnectorCredentialContext,
	VelocityDeal,
	VelocityWebhookAgent,
	VelocityWebhookPayload,
} from "../../../../convex/velocity/contracts";
import { createTestConvex, ensureSeededIdentity } from "../../auth/helpers";
import { FAIRLEND_ADMIN } from "../../auth/identities";

type ConvexTest = ReturnType<typeof createTestConvex>;

const FETCH_CREDENTIAL = {
	apiKeyFingerprint: "sha256:test-api-key",
	credentialId: "velocity-fetch-credential",
	provider: "velocity",
	scope: "deals_out",
	usedFor: "full_deal_fetch",
} satisfies VelocityConnectorCredentialContext;

const WEBHOOK_CREDENTIAL = {
	credentialId: "velocity-webhook-credential",
	provider: "velocity",
	scope: "webhook_ingress",
	usedFor: "webhook_ingress",
} satisfies VelocityConnectorCredentialContext;

const WEBHOOK_AGENT = {
	email: "agent@velocity.example",
	firmCode: "FIRM-1",
	firstName: "Val",
	lastName: "Agent",
	tenantId: "tenant-1",
	username: "velocity.agent",
} satisfies VelocityWebhookAgent;

function makeDeal(overrides: Partial<VelocityDeal> = {}): VelocityDeal {
	const mortgageRequest: NonNullable<VelocityDeal["mortgageRequest"]> = {
		amortizationMonths: 300,
		firstPaymentDate: "2026-06-01",
		interestAdjustmentDate: "2026-05-01",
		lenderName: "Velocity Test Lender",
		maturityDate: "2027-05-01",
		mortgages: [{ amount: 250_000 }],
		payment: 1250,
		paymentFrequency: 3,
		purpose: 10,
		rate: 8.25,
		rateType: 4,
		termInMonths: 12,
	};
	const subjectProperty: NonNullable<VelocityDeal["subjectProperty"]> = {
		city: "Toronto",
		intendedUse: 1,
		postalCode: "M5V 1A1",
		propertyType: "residential",
		province: 9,
		purchasePrice: 350_000,
		streetName: "King",
		streetNumber: "123",
		unitNumber: "1201",
	};

	return {
		agent: "Velocity Agent",
		borrowers: [
			{
				cellPhone: "4165550100",
				email: "borrower@example.test",
				firstName: "Borrower",
				lastName: "One",
			},
		],
		closingDate: "2026-05-01",
		conditions: [{ isApproved: false, isSent: true, name: "PAD evidence" }],
		dateCreated: "2026-04-23T15:00:00.000Z",
		isConfirmedCompliant: true,
		lenderConditions: ["Condition A"],
		lenderReferenceNumber: "LENDER-REF-1001",
		linkApplicationId: "LINK-1001",
		loanCode: "LC-1001",
		mortgageRequest: {
			...mortgageRequest,
			...(overrides.mortgageRequest ?? {}),
		},
		notes: [{ dateCreated: "2026-04-23", text: "Initial note" }],
		status: 6,
		subjectProperty: {
			...subjectProperty,
			...(overrides.subjectProperty ?? {}),
		},
		...overrides,
	};
}

function makeWebhookPayload(
	timestamp = "2026-04-23T15:00:00.000Z"
): VelocityWebhookPayload {
	return {
		agent: WEBHOOK_AGENT,
		events: [
			{
				deal: {
					loanCode: "LC-1001",
					status: 6,
				},
				eventType: 10,
				links: [
					{
						href: "https://velocity.test/deals/LC-1001",
						method: "GET",
						rel: "deal",
					},
				],
				timestamp,
			},
		],
		timestamp,
	};
}

async function persistWebhookEvent(
	t: ConvexTest,
	payload = makeWebhookPayload()
) {
	const rawBody = JSON.stringify(payload);
	const result = await t.mutation(
		internal.velocity.webhook.persistVelocityWebhookEvents,
		{
			connectorCredentialContext: WEBHOOK_CREDENTIAL,
			payload,
			rawBody,
		}
	);
	const webhookEventId = result.acceptedEvents[0]?.webhookEventId;
	if (!webhookEventId) {
		throw new Error("Expected persisted Velocity webhook event");
	}

	return { rawBody, result, webhookEventId };
}

async function applyFullDealSync(
	t: ConvexTest,
	deal: VelocityDeal,
	options: {
		trigger?: "manual_sync_now" | "webhook";
		webhookEventId?: Id<"velocityWebhookEvents">;
	} = {}
) {
	const loanCode = deal.loanCode ?? "LC-1001";
	return await t.mutation(internal.velocity.sync.applyVelocityFullDealSync, {
		fetchCredentialContext: FETCH_CREDENTIAL,
		loanCode,
		rawDeal: deal,
		rawResponseBody: JSON.stringify({ deals: [deal] }),
		request: {
			loanCode,
			method: "GET",
			url: `https://velocity.test/v1/deals?loancode=${loanCode}`,
		},
		responseStatus: 200,
		startedAt: Date.now(),
		trigger: options.trigger ?? "webhook",
		webhookAgent: WEBHOOK_AGENT,
		webhookCredentialContext: WEBHOOK_CREDENTIAL,
		webhookEventId: options.webhookEventId,
	});
}

async function readVelocityTables(t: ConvexTest) {
	return await t.run(async (ctx) => ({
		audits: await ctx.db.query("auditJournal").collect(),
		exceptions: await ctx.db.query("velocityPackageExceptions").collect(),
		snapshots: await ctx.db.query("velocityPackageSnapshots").collect(),
		syncAttempts: await ctx.db.query("velocitySyncAttempts").collect(),
		webhookEvents: await ctx.db.query("velocityWebhookEvents").collect(),
		workspaces: await ctx.db.query("velocityPackageWorkspaces").collect(),
	}));
}

describe("Velocity webhook ingestion and full deal sync", () => {
	beforeEach(() => {
		vi.stubEnv("VELOCITY_API_BASE_URL", "https://velocity.test");
		vi.stubEnv("VELOCITY_API_KEY", "velocity-test-api-key");
		vi.stubEnv(
			"VELOCITY_CONNECTOR_CREDENTIAL_ID",
			"velocity-fetch-credential"
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it("persists raw webhook events with provenance and deduplicates idempotently", async () => {
		const t = createTestConvex();
		const payload = makeWebhookPayload();
		const first = await persistWebhookEvent(t, payload);
		const second = await t.mutation(
			internal.velocity.webhook.persistVelocityWebhookEvents,
			{
				connectorCredentialContext: WEBHOOK_CREDENTIAL,
				payload,
				rawBody: first.rawBody,
			}
		);
		const state = await readVelocityTables(t);

		expect(first.result).toMatchObject({
			acceptedEvents: [
				{
					eventType: 10,
					isDuplicate: false,
					loanCode: "LC-1001",
					statusCode: 6,
				},
			],
			duplicateEvents: 0,
		});
		expect(second).toMatchObject({
			acceptedEvents: [{ isDuplicate: true }],
			duplicateEvents: 1,
		});
		expect(state.webhookEvents).toHaveLength(1);
		expect(state.webhookEvents[0]).toMatchObject({
			connectorCredentialContext: {
				email: WEBHOOK_AGENT.email,
				provider: "velocity",
				scope: "webhook_ingress",
				usedFor: "webhook_ingress",
			},
			loanCode: "LC-1001",
			rawBody: first.rawBody,
			status: "pending",
			webhookAgent: WEBHOOK_AGENT,
		});
	});

	it("creates a workspace, upstream snapshot, sync attempt, webhook status, and audit trail from a full deal", async () => {
		const t = createTestConvex();
		const { webhookEventId } = await persistWebhookEvent(t);
		const result = await applyFullDealSync(t, makeDeal(), { webhookEventId });
		const state = await readVelocityTables(t);
		const workspace = state.workspaces[0];

		expect(result.result).toBe("succeeded");
		expect(result.workspaceId).toBeDefined();
		expect(workspace).toMatchObject({
			currentVelocityStatusCode: 6,
			currentVelocityStatusLabel: "Funded",
			linkApplicationId: "LINK-1001",
			loanCode: "LC-1001",
			state: "needs_fairlend_data",
		});
		expect(workspace?.normalizedCore.mortgageRequest).toMatchObject({
			fairlendPaymentFrequency: "monthly",
			fairlendRateType: "fixed",
			requestedPrincipal: 250_000,
		});
		expect(
			workspace?.readiness.blockers.map((blocker) => blocker.code)
		).toEqual(
			expect.arrayContaining([
				"missing_bank_data",
				"missing_pad_pdf",
				"missing_fairlend_owned_field",
			])
		);
		expect(state.snapshots).toHaveLength(1);
		expect(state.snapshots[0]).toMatchObject({
			createdBy: "webhook",
			snapshotType: "upstream_core",
			workspaceId: result.workspaceId,
		});
		expect(state.syncAttempts).toHaveLength(1);
		expect(state.syncAttempts[0]).toMatchObject({
			idempotencyKey: expect.stringContaining("velocity:sync:LINK-1001:"),
			result: "succeeded",
			trigger: "webhook",
			workspaceId: result.workspaceId,
		});
		expect(state.webhookEvents[0]).toMatchObject({
			status: "processed",
			workspaceId: result.workspaceId,
		});
		expect(state.audits.map((audit) => audit.eventType)).toEqual(
			expect.arrayContaining([
				"velocity_webhook_received",
				"velocity_webhook_provenance_recorded",
				"velocity_full_deal_fetch_attempted",
				"velocity_normalized",
				"velocity_identity_validated",
				"velocity_readiness_recomputed",
			])
		);
		expect(
			state.audits.find(
				(audit) => audit.eventType === "velocity_webhook_provenance_recorded"
			)
		).toMatchObject({
			channel: "api_webhook",
			payload: {
				connectorCredentialContext: {
					provider: "velocity",
					scope: "webhook_ingress",
					usedFor: "webhook_ingress",
				},
				webhookAgent: WEBHOOK_AGENT,
			},
		});
	});

	it("treats repeated full deal payloads as duplicate no-ops", async () => {
		const t = createTestConvex();
		const deal = makeDeal();
		const first = await applyFullDealSync(t, deal);
		const second = await applyFullDealSync(t, deal);
		const state = await readVelocityTables(t);

		expect(first.result).toBe("succeeded");
		expect(second).toMatchObject({
			result: "duplicate_noop",
			syncAttemptId: first.syncAttemptId,
			workspaceId: first.workspaceId,
		});
		expect(state.workspaces).toHaveLength(1);
		expect(state.snapshots).toHaveLength(1);
		expect(state.syncAttempts).toHaveLength(1);
	});

	it("opens a provenance-rich identity exception when linkApplicationId is missing", async () => {
		const t = createTestConvex();
		const { webhookEventId } = await persistWebhookEvent(t);
		const result = await applyFullDealSync(
			t,
			makeDeal({ linkApplicationId: null }),
			{ webhookEventId }
		);
		const state = await readVelocityTables(t);

		expect(result.result).toBe("exception");
		expect(result.workspaceId).toBeUndefined();
		expect(state.workspaces).toHaveLength(0);
		expect(state.exceptions).toHaveLength(1);
		expect(state.exceptions[0]).toMatchObject({
			kind: "identity_exception",
			severity: "critical",
			sourceSyncAttemptId: result.syncAttemptId,
			sourceWebhookEventId: webhookEventId,
			status: "open",
		});
		expect(state.webhookEvents[0]).toMatchObject({
			error: "Velocity deal is missing linkApplicationId",
			status: "failed",
		});
		expect(
			state.audits.find(
				(audit) => audit.eventType === "velocity_identity_exception_opened"
			)
			).toMatchObject({
				channel: "api_webhook",
				outcome: "rejected",
				payload: {
					webhookAgent: WEBHOOK_AGENT,
					webhookCredentialContext: WEBHOOK_CREDENTIAL,
				},
			});
		});

	it("opens an identity exception when multiple workspaces share linkApplicationId", async () => {
		const t = createTestConvex();
		const deal = makeDeal();
		const first = await applyFullDealSync(t, deal);
		await t.run(async (ctx) => {
			if (!first.workspaceId) {
				throw new Error("Expected workspace from initial Velocity sync");
			}

			const workspace = await ctx.db.get(first.workspaceId);
			if (!workspace) {
				throw new Error("Expected persisted Velocity workspace");
			}

			const { _creationTime, _id: _workspaceId, ...workspaceRecord } = workspace;
			await ctx.db.insert("velocityPackageWorkspaces", {
				...workspaceRecord,
				createdAt: _creationTime + 1,
				lastSyncAttemptId: undefined,
				lastWebhookEventId: undefined,
				updatedAt: workspace.updatedAt + 1,
			});
		});

		const collision = await applyFullDealSync(
			t,
			makeDeal({ lenderReferenceNumber: "LENDER-REF-COLLISION" })
		);
		const state = await readVelocityTables(t);

		expect(collision.result).toBe("exception");
		expect(collision.workspaceId).toBe(first.workspaceId);
		expect(state.workspaces).toHaveLength(2);
		expect(state.exceptions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "identity_exception",
					message:
						"Multiple Velocity package workspaces exist for the same linkApplicationId.",
					severity: "critical",
					sourceSyncAttemptId: collision.syncAttemptId,
				}),
			])
		);
		expect(
			state.audits.find(
				(audit) => audit.eventType === "velocity_identity_exception_opened"
			)
		).toMatchObject({
			outcome: "rejected",
			payload: {
				linkApplicationId: "LINK-1001",
				loanCode: "LC-1001",
			},
		});
	});

	it("runs manual Sync now through the same full deal pipeline", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const initial = await applyFullDealSync(t, makeDeal());
		const changedDeal = makeDeal({
			lenderReferenceNumber: "LENDER-REF-2002",
			mortgageRequest: {
				payment: 1300,
			},
		});
		const fetchMock = vi.fn<typeof fetch>(async () => {
			return new Response(JSON.stringify({ deals: [changedDeal] }), {
				status: 200,
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.action(api.velocity.sync.syncVelocityPackageNow, {
				workspaceId: initial.workspaceId as Id<"velocityPackageWorkspaces">,
			});
		const state = await readVelocityTables(t);

		expect(result).toMatchObject({
			result: "succeeded",
			workspaceId: initial.workspaceId,
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
			"/v1/deals?apikey=velocity-test-api-key&loancode=LC-1001"
		);
		expect(state.workspaces).toHaveLength(1);
		expect(state.workspaces[0]).toMatchObject({
			lenderReferenceNumber: "LENDER-REF-2002",
			normalizedCore: {
				mortgageRequest: {
					paymentAmount: 1300,
				},
			},
		});
		expect(state.snapshots).toHaveLength(2);
		expect(state.syncAttempts.map((attempt) => attempt.trigger)).toEqual(
			expect.arrayContaining(["manual_sync_now", "webhook"])
		);
	});
});
