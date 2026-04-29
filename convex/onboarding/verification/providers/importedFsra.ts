import {
	type BrokerOnboardingBrokerageAssociation,
	type BrokerOnboardingBrokerageCheck,
	type BrokerOnboardingPersonNameInput,
	type BrokerOnboardingRegulatorFreshness,
	type BrokerOnboardingRegulatorLicenseType,
	type BrokerOnboardingRegulatorSourceSnapshot,
	normalizeBrokerOnboardingPersonName,
	normalizeBrokerOnboardingProvince,
	type VerificationEvidenceReference,
} from "../../../../shared/brokerOnboarding/contracts";
import {
	type FsraPersistedStatus,
	normalizeOptionalFsraIdentifier,
} from "../fsraFixtures";
import type {
	RegulatorDirectoryBrokerageLookupRequest,
	RegulatorDirectoryLookupRequest,
	RegulatorDirectoryProvider,
} from "../interface";

export interface ImportedFsraRegulatorRecord {
	brokerageName?: string | null;
	brokerageNumber?: string | null;
	dataAsOf?: number | null;
	freshness?: BrokerOnboardingRegulatorFreshness;
	legalName: BrokerOnboardingPersonNameInput;
	licenseNumber: string;
	licenseType?: BrokerOnboardingRegulatorLicenseType | null;
	province: string;
	sourceSnapshot?: BrokerOnboardingRegulatorSourceSnapshot | null;
	status: FsraPersistedStatus;
}

export interface ImportedFsraBrokerageRecord {
	brokerageName: string;
	brokerageNumber: string;
	dataAsOf?: number | null;
	freshness?: BrokerOnboardingRegulatorFreshness;
	province: string;
	sourceSnapshot?: BrokerOnboardingRegulatorSourceSnapshot | null;
	status: FsraPersistedStatus;
}

export interface ImportedFsraRegulatorProviderOptions {
	lookupBrokerageRecord?:
		| ((
				request: RegulatorDirectoryBrokerageLookupRequest
		  ) =>
				| ImportedFsraBrokerageRecord
				| null
				| Promise<ImportedFsraBrokerageRecord | null>)
		| undefined;
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
	identifier: string,
	capturedAt: number,
	referenceType: VerificationEvidenceReference["referenceType"],
	label: string
): VerificationEvidenceReference {
	return {
		provider: "imported_fsra",
		referenceId: `imported-fsra:${identifier.trim().toLowerCase()}`,
		referenceType,
		capturedAt,
		label,
	};
}

function trimToNull(value: string | null | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

function normalizeBrokerageAssociation(
	request: RegulatorDirectoryLookupRequest,
	record: ImportedFsraRegulatorRecord | null
): BrokerOnboardingBrokerageAssociation | null {
	const requestedBrokerageNumber = trimToNull(request.expectedBrokerageNumber);
	const requestedBrokerageName = trimToNull(request.expectedBrokerageName);
	const normalizedRequestedBrokerageNumber = normalizeOptionalFsraIdentifier(
		requestedBrokerageNumber
	);

	if (!(requestedBrokerageNumber || requestedBrokerageName)) {
		return null;
	}

	const actualBrokerageNumber = normalizeOptionalFsraIdentifier(
		record?.brokerageNumber
	);
	const actualBrokerageName = trimToNull(record?.brokerageName);
	let matched: boolean | null = null;

	if (record) {
		const numberMatches =
			normalizedRequestedBrokerageNumber === null ||
			actualBrokerageNumber === normalizedRequestedBrokerageNumber;
		const nameMatches =
			requestedBrokerageName === null ||
			actualBrokerageName?.toLowerCase() ===
				requestedBrokerageName.toLowerCase();
		matched = numberMatches && nameMatches;
	}

	return {
		matched,
		requestedBrokerageName,
		requestedBrokerageNumber: normalizedRequestedBrokerageNumber,
	};
}

export function createImportedFsraRegulatorProvider(
	options: ImportedFsraRegulatorProviderOptions = {}
): RegulatorDirectoryProvider {
	const now = options.now ?? Date.now;

	return {
		mode: "imported_fsra",
		providerKey: "imported_fsra",
		async lookupBrokerage(request: RegulatorDirectoryBrokerageLookupRequest) {
			const checkedAt = now();
			const evidenceReference = buildEvidenceReference(
				request.brokerageNumber,
				checkedAt,
				"regulator_record",
				"Imported FSRA brokerage record"
			);

			if (!options.lookupBrokerageRecord) {
				return {
					provider: "imported_fsra",
					status: "provider_unavailable",
					freshness: "unknown",
					brokerageNumber: request.brokerageNumber,
					brokerageName: null,
					licenseProvince: normalizeBrokerOnboardingProvince(request.province),
					checkedAt,
					dataAsOf: null,
					evidenceReferences: [evidenceReference],
					sourceSnapshot: null,
				} satisfies BrokerOnboardingBrokerageCheck;
			}

			const record = await options.lookupBrokerageRecord(request);
			if (!record) {
				return {
					provider: "imported_fsra",
					status: "not_found",
					freshness: "unknown",
					brokerageNumber: request.brokerageNumber,
					brokerageName: null,
					licenseProvince: normalizeBrokerOnboardingProvince(request.province),
					checkedAt,
					dataAsOf: null,
					evidenceReferences: [evidenceReference],
					sourceSnapshot: null,
				} satisfies BrokerOnboardingBrokerageCheck;
			}

			return {
				provider: "imported_fsra",
				status: record.status,
				freshness: record.freshness ?? "unknown",
				brokerageNumber: record.brokerageNumber,
				brokerageName: record.brokerageName,
				licenseProvince: normalizeBrokerOnboardingProvince(record.province),
				checkedAt,
				dataAsOf: record.dataAsOf ?? null,
				evidenceReferences: [evidenceReference],
				sourceSnapshot: record.sourceSnapshot ?? null,
			} satisfies BrokerOnboardingBrokerageCheck;
		},
		async lookupLicense(request: RegulatorDirectoryLookupRequest) {
			const checkedAt = now();
			if (!options.lookupRecord) {
				return {
					provider: "imported_fsra",
					status: "provider_unavailable",
					freshness: "unknown",
					brokerageAssociation: normalizeBrokerageAssociation(request, null),
					brokerageName: null,
					brokerageNumber: null,
					licenseNumber: request.licenseNumber,
					licenseProvince: normalizeBrokerOnboardingProvince(request.province),
					legalName: null,
					licenseType: null,
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
					sourceSnapshot: null,
				};
			}

			const record = await options.lookupRecord(request);
			if (!record) {
				return {
					provider: "imported_fsra",
					status: "not_found",
					freshness: "unknown",
					brokerageAssociation: normalizeBrokerageAssociation(request, null),
					brokerageName: null,
					brokerageNumber: null,
					licenseNumber: request.licenseNumber,
					licenseProvince: normalizeBrokerOnboardingProvince(request.province),
					legalName: null,
					licenseType: null,
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
					sourceSnapshot: null,
				};
			}

			return {
				provider: "imported_fsra",
				status: record.status,
				freshness: record.freshness ?? "unknown",
				brokerageAssociation: normalizeBrokerageAssociation(request, record),
				brokerageName: record.brokerageName ?? null,
				brokerageNumber: record.brokerageNumber ?? null,
				licenseNumber: record.licenseNumber,
				licenseProvince: normalizeBrokerOnboardingProvince(record.province),
				legalName: normalizeBrokerOnboardingPersonName(record.legalName),
				licenseType: record.licenseType ?? null,
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
				sourceSnapshot: record.sourceSnapshot ?? null,
			};
		},
	};
}
