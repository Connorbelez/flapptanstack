import { describe, expect, it } from "vitest";
import {
	buildRawInvitationToken,
	calculateInvitationExpiry,
	constantTimeHexEqual,
	generateInvitationToken,
	hashInvitationToken,
	isInvitationExpired,
	verifyInvitationToken,
} from "../tokenUtils";

const SHA_256_HEX_PATTERN = /^[0-9a-f]{64}$/u;

describe("legal representation invitation token utilities", () => {
	it("generates hash-only invitation token material", async () => {
		const randomBytes = Uint8Array.from({ length: 32 }, (_, index) => index);
		const token = await generateInvitationToken({ randomBytes });

		expect(token.token).toBe(
			"flinv_000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
		);
		expect(token.tokenHash).toMatch(SHA_256_HEX_PATTERN);
		expect(token.tokenHash).not.toContain(token.token);
	});

	it("verifies only the exact raw token against the stored hash", async () => {
		const token = buildRawInvitationToken({
			randomBytes: Uint8Array.from({ length: 32 }, (_, index) => 255 - index),
		});
		const tokenHash = await hashInvitationToken(token);

		await expect(
			verifyInvitationToken({ expectedHash: tokenHash, token })
		).resolves.toBe(true);
		await expect(
			verifyInvitationToken({
				expectedHash: tokenHash,
				token: token.replace("flinv_", "flinv_tampered_"),
			})
		).resolves.toBe(false);
	});

	it("uses constant-time hex comparison semantics", () => {
		const left = "a".repeat(64);
		const same = "a".repeat(64);
		const differentSameLength = `${"a".repeat(63)}b`;
		const invalid = "not-a-digest";

		expect(constantTimeHexEqual(left, same)).toBe(true);
		expect(constantTimeHexEqual(left, differentSameLength)).toBe(false);
		expect(constantTimeHexEqual(left, invalid)).toBe(false);
	});

	it("calculates and evaluates expiration windows", () => {
		const expiresAt = calculateInvitationExpiry({ now: 1000, ttlMs: 500 });

		expect(expiresAt).toBe(1500);
		expect(isInvitationExpired({ expiresAt, now: 1499 })).toBe(false);
		expect(isInvitationExpired({ expiresAt, now: 1500 })).toBe(true);
	});

	it("rejects weak token configuration", () => {
		expect(() =>
			buildRawInvitationToken({ randomBytes: Uint8Array.from([1, 2, 3]) })
		).toThrow("at least 16 random bytes");
		expect(() =>
			buildRawInvitationToken({
				prefix: "Invalid Prefix",
				randomBytes: Uint8Array.from({ length: 16 }, () => 1),
			})
		).toThrow("prefix is invalid");
	});
});
