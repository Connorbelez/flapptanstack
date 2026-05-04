import type { Id } from "../_generated/dataModel";
import {
	normalizeBarNumber,
	normalizeJurisdiction,
	normalizeLawyerEmail,
	normalizeLawyerName,
	normalizeLegalSourceSnapshot,
} from "./normalization";
import type {
	LawyerVerificationCheckType,
	LawyerVerificationOutcome,
	LawyerVerificationProvider as LawyerVerificationProviderCode,
	LawyerVerificationReasonCode,
	LegalSourceSnapshot,
	LsoLicensingStatus,
	LsoRestrictionStatus,
} from "./validators";

export interface NormalizedLawyerIdentity {
	readonly authId?: string;
	readonly barNumber?: string;
	readonly displayName?: string;
	readonly jurisdiction?: string;
	readonly normalizedEmail?: string;
	readonly normalizedName?: string;
}

export interface LsoReferenceInput {
	readonly barNumber?: string;
	readonly displayName?: string;
	readonly jurisdiction?: string;
	readonly licensingStatus?: LsoLicensingStatus;
	readonly lsoLawyerId?: Id<"lsoLawyers">;
	readonly restrictionStatus?: LsoRestrictionStatus;
	readonly restrictionSummary?: string;
	readonly source?: string;
	readonly sourceSnapshot?: LegalSourceSnapshot;
}

export interface LawyerVerificationDealContext {
	readonly dealId?: Id<"deals">;
	readonly lawyerProfileId?: Id<"lawyerProfiles">;
}

export interface LawyerVerificationRequest {
	readonly checkType: LawyerVerificationCheckType;
	readonly dealContext?: LawyerVerificationDealContext;
	readonly identity: NormalizedLawyerIdentity;
	readonly lsoReference?: LsoReferenceInput;
	readonly requestedAt: number;
	readonly requestedBy: string;
}

export interface LawyerVerificationProviderResult {
	readonly evidenceHash?: string;
	readonly expiresAt?: number;
	readonly outcome: LawyerVerificationOutcome;
	readonly provider: LawyerVerificationProviderCode;
	readonly providerReferenceId?: string;
	readonly reasonCodes: readonly LawyerVerificationReasonCode[];
	readonly sourceSnapshot: LegalSourceSnapshot;
}

export interface LawyerVerificationProvider {
	verify(
		request: LawyerVerificationRequest
	): Promise<LawyerVerificationProviderResult>;
}

export function normalizeLawyerIdentity(args: {
	readonly authId?: string;
	readonly barNumber?: string;
	readonly displayName?: string;
	readonly email?: string;
	readonly jurisdiction?: string;
}): NormalizedLawyerIdentity {
	return {
		authId: args.authId,
		barNumber:
			args.barNumber === undefined
				? undefined
				: normalizeBarNumber(args.barNumber),
		displayName: args.displayName,
		jurisdiction:
			args.jurisdiction === undefined
				? undefined
				: normalizeJurisdiction(args.jurisdiction),
		normalizedEmail:
			args.email === undefined ? undefined : normalizeLawyerEmail(args.email),
		normalizedName:
			args.displayName === undefined
				? undefined
				: normalizeLawyerName(args.displayName),
	};
}

function sourceSnapshotFromRequest(
	request: LawyerVerificationRequest
): LegalSourceSnapshot {
	const lso = request.lsoReference;
	return normalizeLegalSourceSnapshot({
		checkType: request.checkType,
		provider: "test",
		requestedAt: String(request.requestedAt),
		requestedBy: request.requestedBy,
		...(request.identity.authId === undefined
			? {}
			: { authId: request.identity.authId }),
		...(request.identity.barNumber === undefined
			? {}
			: { barNumber: request.identity.barNumber }),
		...(request.identity.jurisdiction === undefined
			? {}
			: { jurisdiction: request.identity.jurisdiction }),
		...(request.identity.normalizedEmail === undefined
			? {}
			: { normalizedEmail: request.identity.normalizedEmail }),
		...(lso?.licensingStatus === undefined
			? {}
			: { licensingStatus: lso.licensingStatus }),
		...(lso?.restrictionStatus === undefined
			? {}
			: { restrictionStatus: lso.restrictionStatus }),
		...(lso?.restrictionSummary === undefined
			? {}
			: { restrictionSummary: lso.restrictionSummary }),
		...(lso?.source === undefined ? {} : { source: lso.source }),
		...(lso?.sourceSnapshot ?? {}),
	});
}

function evaluateLsoReference(
	request: LawyerVerificationRequest
): Pick<LawyerVerificationProviderResult, "outcome" | "reasonCodes"> {
	const lso = request.lsoReference;
	if (!lso) {
		return {
			outcome: "requires_review",
			reasonCodes: ["license_not_found", "requires_admin_review"],
		};
	}
	if (lso.licensingStatus === "licensed" && lso.restrictionStatus === "clear") {
		return {
			outcome: "eligible",
			reasonCodes: ["active_license"],
		};
	}
	if (
		lso.licensingStatus === "suspended" ||
		lso.licensingStatus === "administratively_suspended" ||
		lso.restrictionStatus === "suspended"
	) {
		return {
			outcome: "ineligible",
			reasonCodes: ["license_suspended"],
		};
	}
	if (lso.restrictionStatus === "restricted") {
		return {
			outcome: "ineligible",
			reasonCodes: ["license_restricted", "restriction_current"],
		};
	}
	if (
		lso.licensingStatus === "unknown" ||
		lso.restrictionStatus === "requires_review" ||
		lso.restrictionStatus === "unknown"
	) {
		return {
			outcome: "requires_review",
			reasonCodes: ["requires_admin_review"],
		};
	}
	return {
		outcome: "ineligible",
		reasonCodes: ["license_not_found"],
	};
}

export class DeterministicLawyerVerificationProvider
	implements LawyerVerificationProvider
{
	private readonly expiresInMs: number;
	private readonly provider: Extract<
		LawyerVerificationProviderCode,
		"manual_admin" | "test"
	>;

	constructor(
		provider: Extract<
			LawyerVerificationProviderCode,
			"manual_admin" | "test"
		> = "test",
		expiresInMs = 1000 * 60 * 60 * 24 * 90
	) {
		this.provider = provider;
		this.expiresInMs = expiresInMs;
	}

	async verify(
		request: LawyerVerificationRequest
	): Promise<LawyerVerificationProviderResult> {
		const evaluation = evaluateLsoReference(request);
		return {
			outcome: evaluation.outcome,
			provider: this.provider,
			reasonCodes: evaluation.reasonCodes,
			sourceSnapshot: {
				...sourceSnapshotFromRequest(request),
				provider: this.provider,
			},
			expiresAt:
				evaluation.outcome === "eligible"
					? request.requestedAt + this.expiresInMs
					: undefined,
		};
	}
}

export function buildManualLawyerVerificationResult(args: {
	readonly evidenceHash?: string;
	readonly expiresAt?: number;
	readonly outcome: LawyerVerificationOutcome;
	readonly reasonCodes: readonly LawyerVerificationReasonCode[];
	readonly sourceSnapshot?: LegalSourceSnapshot;
}): LawyerVerificationProviderResult {
	return {
		evidenceHash: args.evidenceHash,
		expiresAt: args.expiresAt,
		outcome: args.outcome,
		provider: "manual_admin",
		reasonCodes: args.reasonCodes,
		sourceSnapshot: normalizeLegalSourceSnapshot({
			provider: "manual_admin",
			...(args.sourceSnapshot ?? {}),
		}),
	};
}
