import { ConvexError } from "convex/values";

export function normalizeFileWorkspaceEmail(email: string): string {
	const normalized = email.trim().toLocaleLowerCase("en-CA");
	if (!normalized.includes("@")) {
		throw new ConvexError("Participant email is invalid");
	}
	return normalized;
}

export function participantKeyForAuthId(authId: string): string {
	const normalized = authId.trim();
	if (!normalized) {
		throw new ConvexError("Participant auth id is required");
	}
	return `auth:${normalized}`;
}

export function participantKeyForEmail(email: string): string {
	return `email:${normalizeFileWorkspaceEmail(email)}`;
}
