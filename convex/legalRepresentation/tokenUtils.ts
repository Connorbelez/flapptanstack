const DEFAULT_TOKEN_BYTES = 32;
const DEFAULT_TOKEN_PREFIX = "flinv";
const SHA_256_HEX_LENGTH = 64;
const HEX_ALPHABET = "0123456789abcdef";
const TOKEN_PREFIX_PATTERN = /^[a-z][a-z0-9_-]*$/u;
const SHA_256_HEX_PATTERN = /^[0-9a-f]+$/u;

export interface GenerateInvitationTokenArgs {
	readonly byteLength?: number;
	readonly prefix?: string;
	readonly randomBytes?: Uint8Array;
}

export interface InvitationToken {
	readonly token: string;
	readonly tokenHash: string;
}

export function calculateInvitationExpiry(args: {
	readonly now: number;
	readonly ttlMs: number;
}): number {
	if (!Number.isFinite(args.now) || args.now < 0) {
		throw new Error("Invitation expiry requires a non-negative timestamp");
	}
	if (!Number.isFinite(args.ttlMs) || args.ttlMs <= 0) {
		throw new Error("Invitation expiry requires a positive ttlMs");
	}
	return args.now + args.ttlMs;
}

export function isInvitationExpired(args: {
	readonly expiresAt: number;
	readonly now: number;
}): boolean {
	return args.expiresAt <= args.now;
}

export async function generateInvitationToken(
	args: GenerateInvitationTokenArgs = {}
): Promise<InvitationToken> {
	const token = buildRawInvitationToken(args);
	return {
		token,
		tokenHash: await hashInvitationToken(token),
	};
}

export function buildRawInvitationToken(
	args: GenerateInvitationTokenArgs = {}
): string {
	const bytes = args.randomBytes ?? secureRandomBytes(args.byteLength);
	const prefix = args.prefix ?? DEFAULT_TOKEN_PREFIX;
	if (bytes.byteLength < 16) {
		throw new Error("Invitation tokens require at least 16 random bytes");
	}
	if (!TOKEN_PREFIX_PATTERN.test(prefix)) {
		throw new Error("Invitation token prefix is invalid");
	}
	return `${prefix}_${toHex(bytes)}`;
}

export async function hashInvitationToken(token: string): Promise<string> {
	const normalized = normalizeToken(token);
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(normalized)
	);
	return toHex(new Uint8Array(digest));
}

export async function verifyInvitationToken(args: {
	readonly expectedHash: string;
	readonly token: string;
}): Promise<boolean> {
	const providedHash = await hashInvitationToken(args.token);
	return constantTimeHexEqual(providedHash, args.expectedHash);
}

export function constantTimeHexEqual(left: string, right: string): boolean {
	const leftBytes = fromHex(left);
	const rightBytes = fromHex(right);
	const maxLength = Math.max(leftBytes.length, rightBytes.length);
	let diff = leftBytes.length ^ rightBytes.length;
	for (let index = 0; index < maxLength; index += 1) {
		diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
	}
	return diff === 0;
}

function secureRandomBytes(byteLength = DEFAULT_TOKEN_BYTES): Uint8Array {
	if (!Number.isInteger(byteLength) || byteLength < 16) {
		throw new Error("Invitation token byte length must be at least 16");
	}
	const bytes = new Uint8Array(byteLength);
	crypto.getRandomValues(bytes);
	return bytes;
}

function normalizeToken(token: string): string {
	const normalized = token.trim();
	if (normalized.length === 0) {
		throw new Error("Invitation token is required");
	}
	return normalized;
}

function toHex(bytes: Uint8Array): string {
	let result = "";
	for (const byte of bytes) {
		result += HEX_ALPHABET[byte >> 4] ?? "0";
		result += HEX_ALPHABET[byte & 0x0f] ?? "0";
	}
	return result;
}

function fromHex(value: string): Uint8Array {
	const normalized = value.trim().toLowerCase();
	if (
		normalized.length !== SHA_256_HEX_LENGTH ||
		!SHA_256_HEX_PATTERN.test(normalized)
	) {
		return new Uint8Array();
	}
	const bytes = new Uint8Array(normalized.length / 2);
	for (let index = 0; index < normalized.length; index += 2) {
		bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);
	}
	return bytes;
}
