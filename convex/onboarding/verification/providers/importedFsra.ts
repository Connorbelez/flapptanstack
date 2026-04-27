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

export interface ImportedFsraRegulatorRecord {
	dataAsOf?: number | null;
	freshness?: BrokerOnboardingRegulatorFreshness;
	legalName: BrokerOnboardingPersonNameInput;
	licenseNumber: string;
	province: string;
	status: Exclude<
		BrokerOnboardingRegulatorStatus,
		"not_found" | "provider_unavailable"
	>;
}

export interface ImportedFsraRegulatorProviderOptions {
	lookupRecord?:
		| ((
				request: RegulatorDirectoryLookupRequest
		  ) =>
				| ImportedFsraRegulatorRecord
				| null
				| Promise<ImportedFsraRegulatorRecord | null>)
		| undefined;
	now?: () => number;
}

function buildEvidenceReference(
	licenseNumber: string,
	capturedAt: number,
	referenceType: VerificationEvidenceReference["referenceType"],
	label: string
): VerificationEvidenceReference {
	return {
		provider: "imported_fsra",
		referenceId: `imported-fsra:${licenseNumber.trim().toLowerCase()}`,
		referenceType,
		capturedAt,
		label,
	};
}

export function createImportedFsraRegulatorProvider(
	options: ImportedFsraRegulatorProviderOptions = {}
): RegulatorDirectoryProvider {
	const now = options.now ?? Date.now;

	return {
		mode: "imported_fsra",
		providerKey: "imported_fsra",
		async lookupLicense(request: RegulatorDirectoryLookupRequest) {
			const checkedAt = now();
			if (!options.lookupRecord) {
				return {
					provider: "imported_fsra",
					status: "provider_unavailable",
					freshness: "unknown",
					licenseNumber: request.licenseNumber,
					licenseProvince: normalizeBrokerOnboardingProvince(request.province),
					legalName: null,
					checkedAt,
					dataAsOf: null,
					evidenceReferences: [
						buildEvidenceReference(
							request.licenseNumber,
							checkedAt,
							"provider_snapshot",
							"Imported FSRA provider unavailable"
						),
					],
				};
			}

			const record = await options.lookupRecord(request);
			if (!record) {
				return {
					provider: "imported_fsra",
					status: "not_found",
					freshness: "unknown",
					licenseNumber: request.licenseNumber,
					licenseProvince: normalizeBrokerOnboardingProvince(request.province),
					legalName: null,
					checkedAt,
					dataAsOf: null,
					evidenceReferences: [
						buildEvidenceReference(
							request.licenseNumber,
							checkedAt,
							"regulator_record",
							"Imported FSRA regulator record (not found)"
						),
					],
				};
			}

			return {
				provider: "imported_fsra",
				status: record.status,
				freshness: record.freshness ?? "unknown",
				licenseNumber: record.licenseNumber,
				licenseProvince: normalizeBrokerOnboardingProvince(record.province),
				legalName: normalizeBrokerOnboardingPersonName(record.legalName),
				checkedAt,
				dataAsOf: record.dataAsOf ?? null,
				evidenceReferences: [
					buildEvidenceReference(
						request.licenseNumber,
						checkedAt,
						"regulator_record",
						"Imported FSRA regulator record"
					),
				],
			};
		},
	};
}
