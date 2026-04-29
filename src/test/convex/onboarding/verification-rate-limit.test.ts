import { describe, expect, it, vi } from "vitest";
import { internal } from "../../../../convex/_generated/api";
import { createDefaultBrokerOnboardingVerificationState } from "../../../../convex/onboarding/brokerApplication/helpers";
import { createGovernedTestConvex, drainScheduledWork } from "./helpers";
import {
	buildVerifiedMemberIdentity,
	startBrokerApplication,
} from "./brokerApplicationTestHelpers";

process.env.DISABLE_GT_HASHCHAIN = "true";
process.env.DISABLE_CASH_LEDGER_HASHCHAIN = "true";

describe("broker onboarding verification abuse controls", () => {
	it("rate limits callback processing bursts for the same application/session tuple", async () => {
		vi.useFakeTimers();
		const t = createGovernedTestConvex();
		try {
			const identity = buildVerifiedMemberIdentity(
				"verification-rate-limit-callback"
			);
			const startResult = await startBrokerApplication(t, identity);
			const sharedSessionId = `mock-idv:verified:${String(startResult.application._id)}`;

			const callbackEventIds = await t.run(async (ctx) => {
				const now = Date.now();
				await ctx.db.patch(startResult.application._id, {
					verificationState: {
						...createDefaultBrokerOnboardingVerificationState(),
						currentIdvProviderKey: "mock_identity",
						currentIdvSessionId: sharedSessionId,
						idvStartedAt: now,
					},
				});

				return Promise.all(
					Array.from({ length: 21 }, (_, index) =>
						ctx.db.insert("brokerOnboardingVerificationCallbackEvents", {
							applicationId: startResult.application._id,
							identityVerificationSessionId: sharedSessionId,
							provider: "mock_identity",
							providerEventId: `evt_rate_limit_${index + 1}`,
							rawBody: JSON.stringify({
								applicationId: String(startResult.application._id),
								eventId: `evt_rate_limit_${index + 1}`,
								sessionId: sharedSessionId,
							}),
							headers: {
								"content-type": "application/json",
							},
							signatureVerified: true,
							status: "pending",
							attempts: 0,
							receivedAt: now + index,
						})
					)
				);
			});

			for (const callbackEventId of callbackEventIds.slice(0, 20)) {
				const result = await t.action(
					internal.onboarding.verification.idvWebhook
						.processBrokerOnboardingIdentityCallback,
					{
						callbackEventId,
					}
				);
				expect(result.ok).toBe(true);
			}

			const blocked = await t.action(
				internal.onboarding.verification.idvWebhook
					.processBrokerOnboardingIdentityCallback,
				{
					callbackEventId: callbackEventIds[20]!,
				}
			);

			expect(blocked.ok).toBe(false);
			expect(blocked.error).toBe("rate_limited");
			expect(blocked.requeued).toBe(true);
			expect(blocked.retryAfter).toBeGreaterThan(0);

			const pendingEvent = await t.run(async (ctx) =>
				ctx.db.get(callbackEventIds[20]!)
			);
			expect(pendingEvent?.status).toBe("pending");
			expect(pendingEvent?.attempts).toBe(0);

			await t.finishAllScheduledFunctions(() =>
				vi.advanceTimersByTime(blocked.retryAfter)
			);

			const processedEvent = await t.run(async (ctx) =>
				ctx.db.get(callbackEventIds[20]!)
			);
			expect(processedEvent?.status).toBe("processed");
			expect(processedEvent?.attempts).toBe(1);
			await drainScheduledWork(t);
		} finally {
			vi.clearAllTimers();
			vi.useRealTimers();
		}
	});
});
