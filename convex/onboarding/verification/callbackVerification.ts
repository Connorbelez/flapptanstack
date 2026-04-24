import { v } from "convex/values";
import { convex } from "../../fluent";

export const MOCK_IDENTITY_SIGNATURE_HEADER = "x-fairlend-mock-signature";

export type BrokerOnboardingCallbackVerificationResult =
	| { ok: true }
	| { ok: false; error: "invalid_signature" }
	| { ok: false; error: "missing_secret" }
	| { ok: false; error: "unsupported_provider" };

function bytesToHex(bytes: Uint8Array) {
	return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

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

async function buildHmacHex(body: string, secret: string) {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"]
	);
	const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
	return bytesToHex(new Uint8Array(signature));
}

export async function buildMockIdentityWebhookSignature(
	body: string,
	secret: string
) {
	return buildHmacHex(body, secret);
}

export async function verifyMockIdentityWebhookSignature(
	body: string,
	signature: string,
	secret: string
) {
	const expected = await buildMockIdentityWebhookSignature(body, secret);
	return expected === signature;
}

function resolveMockIdentityWebhookSecret() {
	const configuredSecret =
		getRuntimeEnv()?.BROKER_ONBOARDING_MOCK_IDV_WEBHOOK_SECRET?.trim();
	return configuredSecret || null;
}

export const verifyBrokerOnboardingCallbackSignatureAction = convex
	.action()
	.input({
		body: v.string(),
		provider: v.string(),
		signature: v.optional(v.string()),
	})
	.handler(
		async (_ctx, args): Promise<BrokerOnboardingCallbackVerificationResult> => {
			if (!args.signature) {
				return { ok: false, error: "invalid_signature" };
			}

			if (args.provider !== "mock_identity") {
				return { ok: false, error: "unsupported_provider" };
			}

			const secret = resolveMockIdentityWebhookSecret();
			if (!secret) {
				return { ok: false, error: "missing_secret" };
			}

			const isValid = await verifyMockIdentityWebhookSignature(
				args.body,
				args.signature,
				secret
			);
			return isValid ? { ok: true } : { ok: false, error: "invalid_signature" };
		}
	)
	.internal();
