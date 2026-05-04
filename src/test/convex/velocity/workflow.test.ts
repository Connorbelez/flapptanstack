import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../../convex/_generated/api";
import { createTestConvex } from "../../auth/helpers";
import { FAIRLEND_ADMIN } from "../../auth/identities";

type ConvexTest = ReturnType<typeof createTestConvex>;
const nodeProcess = process;

function createVelocityWorkflowHarness() {
	return createTestConvex();
}

async function fetchJson<T>(response: Response): Promise<T> {
	expect(response.ok).toBe(true);
	return (await response.json()) as T;
}

function configureMockVelocityFetch(t: ConvexTest) {
	vi.stubEnv("VELOCITY_API_BASE_URL", "https://velocity.test");
	vi.stubEnv("VELOCITY_API_KEY", "velocity-test-api-key");
	vi.stubEnv("VELOCITY_CONNECTOR_CREDENTIAL_ID", "mock-velocity-fetch");
	vi.stubGlobal("fetch", async (input: string | URL | Request) => {
		const rawUrl =
			input instanceof Request
				? input.url
				: input instanceof URL
					? input.toString()
					: input;
		const url = new URL(rawUrl);
		if (url.pathname === "/v1/deals") {
			return Response.json({
				deals: [],
				pageNumber: 1,
				totalDeals: 0,
				totalPages: 1,
			});
		}
		if (url.pathname !== "/api/dev/mock-velocity/v1/deals") {
			throw new Error(`Unexpected mock Velocity fetch URL: ${url.toString()}`);
		}
		const response = await t.fetch(`${url.pathname}${url.search}`, {
			method: "GET",
		});
		return new Response(await response.text(), {
			headers: response.headers,
			status: response.status,
		});
	});
}

function configureWorkosAuthEnv() {
	vi.stubEnv("DISABLE_CASH_LEDGER_HASHCHAIN", "true");
	vi.stubEnv("DISABLE_GT_HASHCHAIN", "true");
	vi.stubEnv("WORKOS_CLIENT_ID", "client_velocity_workflow_test");
	vi.stubEnv("WORKOS_API_KEY", "sk_velocity_workflow_test");
	vi.stubEnv("WORKOS_WEBHOOK_SECRET", "whsec_velocity_workflow_test");
}

describe("Velocity mock workflow ingress", () => {
	beforeEach(() => {
		configureWorkosAuthEnv();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.stubGlobal("process", nodeProcess);
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		vi.stubGlobal("process", nodeProcess);
	});

	it("creates a mock scenario through the dev endpoint and drives real package sync", async () => {
		const t = createVelocityWorkflowHarness();
		configureMockVelocityFetch(t);
		const response = await t.fetch("/api/dev/velocity/scenarios", {
			body: JSON.stringify({
				scenarioName: "progression_to_funded",
				seed: 1001,
			}),
			method: "POST",
		});
		const scenario = await fetchJson<{
			linkApplicationId: string;
			loanCode: string;
			webhookDelivered: boolean;
		}>(response);

		expect(scenario).toMatchObject({
			linkApplicationId: "MOCK-LINK-01001",
			loanCode: "MOCK-LC-01001",
			webhookDelivered: true,
		});

		const state = await t.run(async (ctx) => ({
			mockDeal: await ctx.db
				.query("velocityMockDeals")
				.withIndex("by_loan_code", (query) =>
					query.eq("loanCode", scenario.loanCode)
				)
				.first(),
			syncAttempts: await ctx.db.query("velocitySyncAttempts").collect(),
			webhookEvents: await ctx.db.query("velocityWebhookEvents").collect(),
			workspaces: await ctx.db.query("velocityPackageWorkspaces").collect(),
		}));

		expect(state.mockDeal).toMatchObject({
			linkApplicationId: scenario.linkApplicationId,
			loanCode: scenario.loanCode,
		});
		expect(state.syncAttempts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					loanCode: scenario.loanCode,
					request: expect.objectContaining({
						url: expect.stringContaining("/api/dev/mock-velocity/v1/deals"),
					}),
					result: "succeeded",
					trigger: "mock_scenario",
				}),
			])
		);
		expect(state.webhookEvents).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					loanCode: scenario.loanCode,
					provider: "velocity",
					status: "processed",
				}),
			])
		);
		expect(state.workspaces).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					linkApplicationId: scenario.linkApplicationId,
					loanCode: scenario.loanCode,
					state: "needs_fairlend_data",
				}),
			])
		);
	});

	it("serves and patches stored mock deals without mutating workspace state directly", async () => {
		const t = createVelocityWorkflowHarness();
		configureMockVelocityFetch(t);
		const created = await fetchJson<{ loanCode: string }>(
			await t.fetch("/api/dev/velocity/scenarios", {
				body: JSON.stringify({
					scenarioName: "early_status_package_created",
					seed: 2002,
				}),
				method: "POST",
			})
		);

		const patch = await fetchJson<{ mockDeal: { status: number } }>(
			await t.fetch(
				`/api/dev/mock-velocity/deals?loanCode=${encodeURIComponent(created.loanCode)}`,
				{
					body: JSON.stringify({
						mortgageRequest: { payment: 1400 },
						status: 5,
					}),
					method: "PATCH",
				}
			)
		);
		expect(patch.mockDeal.status).toBe(5);

		const pathStylePatch = await fetchJson<{ mockDeal: { status: number } }>(
			await t.fetch(
				`/api/dev/mock-velocity/deals/${encodeURIComponent(created.loanCode)}`,
				{
					body: JSON.stringify({
						status: 6,
					}),
					method: "PATCH",
				}
			)
		);
		expect(pathStylePatch.mockDeal.status).toBe(6);

		const fetched = await fetchJson<{ deals: Array<{ loanCode: string }> }>(
			await t.fetch(
				`/api/dev/mock-velocity/v1/deals?loancode=${encodeURIComponent(created.loanCode)}`
			)
		);
		expect(fetched.deals).toEqual([
			expect.objectContaining({ loanCode: created.loanCode }),
		]);

		const workspaceBeforeDelivery = await t.run(async (ctx) =>
			ctx.db
				.query("velocityPackageWorkspaces")
				.withIndex("by_loan_code", (query) =>
					query.eq("loanCode", created.loanCode)
				)
				.first()
		);
		expect(workspaceBeforeDelivery?.currentVelocityStatusCode).toBe(4);

		await fetchJson<{ ok: true }>(
			await t.fetch("/api/dev/velocity/webhook", {
				body: JSON.stringify({ loanCode: created.loanCode }),
				method: "POST",
			})
		);

		const workspaceAfterDelivery = await t.run(async (ctx) =>
			ctx.db
				.query("velocityPackageWorkspaces")
				.withIndex("by_loan_code", (query) =>
					query.eq("loanCode", created.loanCode)
				)
				.first()
		);
		expect(workspaceAfterDelivery?.currentVelocityStatusCode).toBe(6);
	});

	it("keeps package query payloads compatible with downstream operator workflow consumers", async () => {
		const t = createVelocityWorkflowHarness();
		configureMockVelocityFetch(t);
		await t.fetch("/api/dev/velocity/scenarios", {
			body: JSON.stringify({
				scenarioName: "unsupported_payment_frequency",
				seed: 3003,
			}),
			method: "POST",
		});

		const rows = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(api.velocity.workspaces.listVelocityPackageWorkspaces, {});
		expect(rows).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					currentVelocityStage: { code: 6, label: "Funded" },
					readiness: expect.objectContaining({
						blockers: expect.arrayContaining([
							expect.objectContaining({
								code: "unsupported_payment_frequency",
								fieldPath: "mortgageRequest.paymentFrequencyCode",
							}),
						]),
						canActivate: false,
					}),
				}),
			])
		);
	});
});
