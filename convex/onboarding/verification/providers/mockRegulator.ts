import {
	type BrokerOnboardingBrokerageAssociation,
	type BrokerOnboardingBrokerageCheck,
	normalizeBrokerOnboardingPersonName,
	normalizeBrokerOnboardingProvince,
	type VerificationEvidenceReference,
} from "../../../../shared/brokerOnboarding/contracts";
import {
	buildDefaultFsraSourceRecords,
	computeFsraFreshness,
	findFsraSourceRecordByLicenseNumber,
	findFsraSourceRecordsByBrokerageNumber,
	normalizeOptionalFsraIdentifier,
	selectPrimaryBrokerageRecord,
} from "../fsraFixtures";
import type {
	RegulatorDirectoryBrokerageLookupRequest,
	RegulatorDirectoryLookupRequest,
	RegulatorDirectoryProvider,
} from "../interface";

export interface MockRegulatorDirectoryProviderOptions {
	now?: () => number;
}

function buildEvidenceReference(
	identifier: string,
	capturedAt: number
): VerificationEvidenceReference {
	return {
		provider: "mock_regulator",
		referenceId: `mock-regulator:${identifier.trim().toLowerCase()}`,
		referenceType: "regulator_record",
		capturedAt,
		label: "Mock regulator lookup",
	};
}

function trimToNull(value: string | null | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

function resolveMockBrokerageAssociation(
	request: RegulatorDirectoryLookupRequest,
	actualBrokerageNumber: string | null,
	actualBrokerageName: string | null
): BrokerOnboardingBrokerageAssociation | null {
	const requestedBrokerageNumber = trimToNull(request.expectedBrokerageNumber);
	const requestedBrokerageName = trimToNull(request.expectedBrokerageName);
	const normalizedRequestedBrokerageNumber = normalizeOptionalFsraIdentifier(
		requestedBrokerageNumber
	);
	if (!(requestedBrokerageNumber || requestedBrokerageName)) {
		return null;
	}

	if (!(actualBrokerageNumber || actualBrokerageName)) {
		return {
			matched: null,
			requestedBrokerageName,
			requestedBrokerageNumber: normalizedRequestedBrokerageNumber,
		};
	}

	const normalizedActualBrokerageNumber = normalizeOptionalFsraIdentifier(
		actualBrokerageNumber
	);
	const numberMatches =
		normalizedRequestedBrokerageNumber === null ||
		normalizedActualBrokerageNumber === normalizedRequestedBrokerageNumber;
	const nameMatches =
		requestedBrokerageName === null ||
		actualBrokerageName?.toLowerCase() === requestedBrokerageName.toLowerCase();

	return {
		matched: numberMatches && nameMatches,
		requestedBrokerageName,
		requestedBrokerageNumber: normalizedRequestedBrokerageNumber,
	};
}

export function createMockRegulatorDirectoryProvider(
	options: MockRegulatorDirectoryProviderOptions = {}
): RegulatorDirectoryProvider {
	const now = options.now ?? Date.now;

	return {
		mode: "mock",
		providerKey: "mock_regulator",
		async lookupBrokerage(request: RegulatorDirectoryBrokerageLookupRequest) {
			const checkedAt = now();
			const records = buildDefaultFsraSourceRecords(checkedAt);
			const evidenceReference = buildEvidenceReference(
				request.brokerageNumber,
				checkedAt
			);
			const primaryRecord = selectPrimaryBrokerageRecord(
				findFsraSourceRecordsByBrokerageNumber(
					records,
					request.brokerageNumber,
					request.province
				)
			);

			if (!primaryRecord) {
				return {
					provider: "mock_regulator",
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

			const freshness = computeFsraFreshness({
				now: checkedAt,
				sourceImportedAt: primaryRecord.sourceImportedAt,
			});

			return {
				provider: "mock_regulator",
				status: primaryRecord.status,
				freshness,
				brokerageNumber:
					primaryRecord.brokerageNumber ?? request.brokerageNumber,
				brokerageName:
					primaryRecord.brokerageName ?? primaryRecord.licenseeFullName,
				licenseProvince: normalizeBrokerOnboardingProvince(request.province),
				checkedAt,
				dataAsOf: primaryRecord.lastVerifiedAt,
				evidenceReferences: [evidenceReference],
				sourceSnapshot: { ...primaryRecord.rawRecord },
			} satisfies BrokerOnboardingBrokerageCheck;
		},
		async lookupLicense(request: RegulatorDirectoryLookupRequest) {
			const checkedAt = now();
			const records = buildDefaultFsraSourceRecords(checkedAt);
			const evidenceReference = buildEvidenceReference(
				request.licenseNumber,
				checkedAt
			);
			const record = findFsraSourceRecordByLicenseNumber(
				records,
				request.licenseNumber,
				request.province
			);

			if (!record) {
				return {
					provider: "mock_regulator",
					status: "not_found",
					freshness: "unknown",
					brokerageAssociation: resolveMockBrokerageAssociation(
						request,
						null,
						null
					),
					brokerageName: null,
					brokerageNumber: null,
					licenseNumber: request.licenseNumber,
					licenseProvince: normalizeBrokerOnboardingProvince(request.province),
					legalName: null,
					licenseType: null,
					checkedAt,
					dataAsOf: null,
					evidenceReferences: [evidenceReference],
					sourceSnapshot: null,
				};
			}

			const actualBrokerageNumber = record.brokerageNumber ?? null;
			const actualBrokerageName = record.brokerageName ?? null;
			const freshness = computeFsraFreshness({
				now: checkedAt,
				sourceImportedAt: record.sourceImportedAt,
			});

			return {
				provider: "mock_regulator",
				status: record.status,
				freshness,
				brokerageAssociation: resolveMockBrokerageAssociation(
					request,
					actualBrokerageNumber,
					actualBrokerageName
				),
				brokerageName: actualBrokerageName,
				brokerageNumber: actualBrokerageNumber,
				licenseNumber: record.licenseNumber,
				licenseProvince: normalizeBrokerOnboardingProvince(request.province),
				legalName: normalizeBrokerOnboardingPersonName({
					fullName: record.licenseeFullName,
				}),
				licenseType: record.licenseType,
				checkedAt,
				dataAsOf: record.lastVerifiedAt,
				evidenceReferences: [evidenceReference],
				sourceSnapshot: { ...record.rawRecord },
			};
		},
	};
}
