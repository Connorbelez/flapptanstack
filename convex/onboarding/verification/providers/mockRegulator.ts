import {
	type BrokerOnboardingPersonNameInput,
	type BrokerOnboardingRegulatorFreshness,
	type BrokerOnboardingRegulatorStatus,
	normalizeBrokerOnboardingPersonName,
	normalizeBrokerOnboardingProvince,
	type VerificationEvidenceReference,
} from "../../../../shared/brokerOnboarding/contracts";
import type {
	RegulatorDirectoryLookupRequest,
	RegulatorDirectoryProvider,
} from "../interface";

const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;

export interface MockRegulatorDirectoryProviderOptions {
	now?: () => number;
}

function inferMockRegulatorStatus(
	licenseNumber: string
): BrokerOnboardingRegulatorStatus {
	const normalized = licenseNumber.trim().toLowerCase();

	if (normalized.includes("unavailable")) {
		return "provider_unavailable";
	}
	if (normalized.includes("missing") || normalized.includes("notfound")) {
		return "not_found";
	}
	if (normalized.includes("inactive")) {
		return "inactive";
	}
	if (normalized.includes("revoked")) {
		return "revoked";
	}
	if (normalized.includes("suspended")) {
		return "suspended";
	}

	return "active";
}

function inferMockFreshness(
	licenseNumber: string
): BrokerOnboardingRegulatorFreshness {
	return licenseNumber.trim().toLowerCase().includes("stale")
		? "stale"
		: "fresh";
}

function buildEvidenceReference(
	licenseNumber: string,
	capturedAt: number
): VerificationEvidenceReference {
	return {
		provider: "mock_regulator",
		referenceId: `mock-regulator:${licenseNumber.trim().toLowerCase()}`,
		referenceType: "regulator_record",
		capturedAt,
		label: "Mock regulator lookup",
	};
}

function buildLegalName(selfReportedName: BrokerOnboardingPersonNameInput) {
	return normalizeBrokerOnboardingPersonName(selfReportedName);
}

export function createMockRegulatorDirectoryProvider(
	options: MockRegulatorDirectoryProviderOptions = {}
): RegulatorDirectoryProvider {
	const now = options.now ?? Date.now;

	return {
		mode: "mock",
		providerKey: "mock_regulator",
		async lookupLicense(request: RegulatorDirectoryLookupRequest) {
			const checkedAt = now();
			const status = inferMockRegulatorStatus(request.licenseNumber);
			const freshness =
				status === "provider_unavailable"
					? "unknown"
					: inferMockFreshness(request.licenseNumber);
			const evidenceReference = buildEvidenceReference(
				request.licenseNumber,
				checkedAt
			);
			let dataAsOf: number | null;
			if (status === "provider_unavailable") {
				dataAsOf = null;
			} else if (freshness === "stale") {
				dataAsOf = checkedAt - EIGHT_DAYS_MS;
			} else {
				dataAsOf = checkedAt;
			}

			return {
				provider: "mock_regulator",
				status,
				freshness,
				licenseNumber: request.licenseNumber,
				licenseProvince: normalizeBrokerOnboardingProvince(request.province),
				legalName:
					status === "not_found" || status === "provider_unavailable"
						? null
						: buildLegalName(request.selfReportedName),
				checkedAt,
				dataAsOf,
				evidenceReferences: [evidenceReference],
			};
		},
	};
}
