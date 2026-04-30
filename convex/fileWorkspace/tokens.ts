import { ConvexError } from "convex/values";
import { FILE_WORKSPACE_SAFE_ERRORS } from "./securityEvents";

const TOKEN_BYTE_LENGTH = 32;
const TOKEN_HASH_PREFIX = "sha256:";

function bytesToHex(bytes: Uint8Array): string {
	return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function generateShareLinkToken(
	getRandomValues: Crypto["getRandomValues"] = crypto.getRandomValues.bind(
		crypto
	)
): string {
	const bytes = new Uint8Array(TOKEN_BYTE_LENGTH);
	getRandomValues(bytes);
	return bytesToHex(bytes);
}

export async function hashShareLinkToken(rawToken: string): Promise<string> {
	const token = rawToken.trim();
	if (!token) {
		throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.ACCESS_DENIED);
	}
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(token)
	);
	return `${TOKEN_HASH_PREFIX}${bytesToHex(new Uint8Array(digest))}`;
}
