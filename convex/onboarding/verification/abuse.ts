import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../../_generated/api";

const rateLimiter = new RateLimiter(components.rateLimiter, {
	brokerOnboardingIdvStart: {
		kind: "fixed window",
		rate: 3,
		period: MINUTE,
	},
	brokerOnboardingVerificationRecompute: {
		kind: "fixed window",
		rate: 6,
		period: MINUTE,
	},
	brokerOnboardingIdvCallbackProcess: {
		kind: "fixed window",
		rate: 20,
		period: MINUTE,
	},
});

const RATE_LIMIT_WINDOWS_MS = {
	brokerOnboardingIdvStart: MINUTE,
	brokerOnboardingVerificationRecompute: MINUTE,
	brokerOnboardingIdvCallbackProcess: MINUTE,
} as const;

const RATE_LIMIT_COUNTS = {
	brokerOnboardingIdvStart: 3,
	brokerOnboardingVerificationRecompute: 6,
	brokerOnboardingIdvCallbackProcess: 20,
} as const;

const inMemoryRateLimitState = new Map<
	string,
	{ count: number; windowStartedAt: number }
>();

function getRuntimeEnv() {
	return (
		(
			globalThis as typeof globalThis & {
				process?: {
					env?: Record<string, string | undefined>;
				};
			}
		).process?.env ?? undefined
	);
}

function shouldUseInMemoryRateLimiter() {
	const env = getRuntimeEnv();
	return Boolean(env?.VITEST || env?.NODE_ENV === "test");
}

function runInMemoryRateLimit(
	limitName: keyof typeof RATE_LIMIT_COUNTS,
	key: string
) {
	const now = Date.now();
	const windowMs = RATE_LIMIT_WINDOWS_MS[limitName];
	const limit = RATE_LIMIT_COUNTS[limitName];
	const stateKey = `${limitName}:${key}`;
	const existing = inMemoryRateLimitState.get(stateKey);

	if (!existing || now - existing.windowStartedAt >= windowMs) {
		inMemoryRateLimitState.set(stateKey, {
			count: 1,
			windowStartedAt: now,
		});
		return { ok: true as const, retryAfter: 0 };
	}

	if (existing.count >= limit) {
		return {
			ok: false as const,
			retryAfter: Math.max(1, windowMs - (now - existing.windowStartedAt)),
		};
	}

	inMemoryRateLimitState.set(stateKey, {
		count: existing.count + 1,
		windowStartedAt: existing.windowStartedAt,
	});
	return { ok: true as const, retryAfter: 0 };
}

export function buildBrokerOnboardingRateLimitKey(args: {
	applicationId?: string | null;
	authUserId?: string | null;
	provider?: string | null;
	sessionId?: string | null;
	scope: "callback" | "idv_start" | "recompute";
}) {
	return [
		args.scope,
		args.provider ?? "provider:none",
		args.authUserId ?? "auth:none",
		args.applicationId ?? "application:none",
		args.sessionId ?? "session:none",
	].join("|");
}

export async function limitBrokerOnboardingIdvStart(
	ctx: Parameters<typeof rateLimiter.limit>[0],
	key: string
) {
	if (shouldUseInMemoryRateLimiter()) {
		return runInMemoryRateLimit("brokerOnboardingIdvStart", key);
	}
	return rateLimiter.limit(ctx, "brokerOnboardingIdvStart", { key });
}

export async function limitBrokerOnboardingVerificationRecompute(
	ctx: Parameters<typeof rateLimiter.limit>[0],
	key: string
) {
	if (shouldUseInMemoryRateLimiter()) {
		return runInMemoryRateLimit("brokerOnboardingVerificationRecompute", key);
	}
	return rateLimiter.limit(ctx, "brokerOnboardingVerificationRecompute", {
		key,
	});
}

export async function limitBrokerOnboardingIdvCallbackProcessing(
	ctx: Parameters<typeof rateLimiter.limit>[0],
	key: string
) {
	if (shouldUseInMemoryRateLimiter()) {
		return runInMemoryRateLimit("brokerOnboardingIdvCallbackProcess", key);
	}
	return rateLimiter.limit(ctx, "brokerOnboardingIdvCallbackProcess", {
		key,
	});
}
