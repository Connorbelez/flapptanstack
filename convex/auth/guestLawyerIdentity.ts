import type { Doc } from "../_generated/dataModel";

type SelectedLawyerSnapshot = Doc<"checkoutSessions">["selectedLawyer"];

const encoder = new TextEncoder();

function normalizeOptionalText(value: string | undefined): string {
	return (value ?? "").trim().replace(/\s+/g, " ");
}

export function normalizeGuestLawyerEmail(email: string): string {
	return email.trim().toLowerCase();
}

export function selectedLawyerComparisonKey(
	selectedLawyer: SelectedLawyerSnapshot
): string {
	if (selectedLawyer.type === "platform_lawyer") {
		return ["platform_lawyer", selectedLawyer.lawyerId].join(":");
	}
	const lso = selectedLawyer.lso;
	return JSON.stringify({
		email: normalizeGuestLawyerEmail(selectedLawyer.email),
		firm: normalizeOptionalText(selectedLawyer.firm),
		lso: lso
			? {
					barNumber: normalizeOptionalText(lso.barNumber),
					jurisdiction: normalizeOptionalText(lso.jurisdiction),
					licensingStatus: normalizeOptionalText(lso.licensingStatus),
					lsoLawyerId: normalizeOptionalText(lso.lsoLawyerId),
					restrictionStatus: normalizeOptionalText(lso.restrictionStatus),
					restrictionSummary: normalizeOptionalText(lso.restrictionSummary),
					source: normalizeOptionalText(lso.source),
					sourceFetchedAt: lso.sourceFetchedAt ?? "",
				}
			: null,
		name: normalizeOptionalText(selectedLawyer.name),
		source: selectedLawyer.source,
		type: "guest_lawyer",
	});
}

async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

export async function selectedLawyerIdempotencyFingerprint(
	selectedLawyer: SelectedLawyerSnapshot
): Promise<string> {
	if (selectedLawyer.type === "platform_lawyer") {
		return `platform_lawyer:${selectedLawyer.lawyerId}`;
	}
	return `guest_lawyer:sha256:${await sha256Hex(
		selectedLawyerComparisonKey(selectedLawyer)
	)}`;
}
