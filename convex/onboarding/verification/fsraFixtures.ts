import {
	type BrokerOnboardingRegulatorFreshness,
	type BrokerOnboardingRegulatorLicenseType,
	type BrokerOnboardingRegulatorSourceSnapshot,
	type BrokerOnboardingRegulatorStatus,
	normalizeBrokerOnboardingProvince,
} from "../../../shared/brokerOnboarding/contracts";
import { DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG } from "./config";

const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;

export interface FsraSourceRecord {
	brokerageName?: string | null;
	brokerageNumber?: string | null;
	lastVerifiedAt: number;
	licenseeFullName: string;
	licenseNumber: string;
	licenseType: BrokerOnboardingRegulatorLicenseType;
	province: string;
	rawRecord: BrokerOnboardingRegulatorSourceSnapshot;
	sourceImportedAt: number;
	status: Exclude<
		BrokerOnboardingRegulatorStatus,
		"not_found" | "provider_unavailable"
	>;
}

interface FsraFixtureTemplate {
	brokerageName?: string | null;
	brokerageNumber?: string | null;
	lastVerifiedAtOffsetMs?: number;
	licenseeFullName: string;
	licenseNumber: string;
	licenseType: BrokerOnboardingRegulatorLicenseType;
	province: string;
	rawRecord?: BrokerOnboardingRegulatorSourceSnapshot;
	sourceImportedAtOffsetMs?: number;
	status: Exclude<
		BrokerOnboardingRegulatorStatus,
		"not_found" | "provider_unavailable"
	>;
}

const DEFAULT_FSRA_FIXTURE_TEMPLATES: readonly FsraFixtureTemplate[] = [
	{
		licenseNumber: "BR-001",
		licenseeFullName: "FairLend Brokerage",
		brokerageNumber: "BR-001",
		brokerageName: "FairLend Brokerage",
		licenseType: "brokerage",
		province: "ON",
		status: "active",
	},
	{
		licenseNumber: "BR-SUSPENDED-1",
		licenseeFullName: "Suspended Brokerage Ltd.",
		brokerageNumber: "BR-SUSPENDED-1",
		brokerageName: "Suspended Brokerage Ltd.",
		licenseType: "brokerage",
		province: "ON",
		status: "suspended",
	},
	{
		licenseNumber: "BR-INACTIVE-1",
		licenseeFullName: "Inactive Brokerage Ltd.",
		brokerageNumber: "BR-INACTIVE-1",
		brokerageName: "Inactive Brokerage Ltd.",
		licenseType: "brokerage",
		province: "ON",
		status: "inactive",
	},
	{
		licenseNumber: "BR-REVOKED-1",
		licenseeFullName: "Revoked Brokerage Ltd.",
		brokerageNumber: "BR-REVOKED-1",
		brokerageName: "Revoked Brokerage Ltd.",
		licenseType: "brokerage",
		province: "ON",
		status: "revoked",
	},
	{
		licenseNumber: "BR-999",
		licenseeFullName: "Different Brokerage Inc.",
		brokerageNumber: "BR-999",
		brokerageName: "Different Brokerage Inc.",
		licenseType: "brokerage",
		province: "ON",
		status: "active",
	},
	{
		licenseNumber: "ON-12345",
		licenseeFullName: "Francois Smith",
		brokerageNumber: "BR-001",
		brokerageName: "FairLend Brokerage",
		licenseType: "agent",
		province: "ON",
		status: "active",
	},
	{
		licenseNumber: "ON-SUSPENDED-1",
		licenseeFullName: "Suspended Broker",
		brokerageNumber: "BR-001",
		brokerageName: "FairLend Brokerage",
		licenseType: "broker",
		province: "ON",
		status: "suspended",
	},
	{
		licenseNumber: "ON-STALE-1",
		licenseeFullName: "Stale Broker",
		brokerageNumber: "BR-001",
		brokerageName: "FairLend Brokerage",
		licenseType: "agent",
		province: "ON",
		status: "active",
		sourceImportedAtOffsetMs: EIGHT_DAYS_MS,
		lastVerifiedAtOffsetMs: EIGHT_DAYS_MS,
	},
	{
		licenseNumber: "ON-MISMATCH-1",
		licenseeFullName: "Mismatched Agent",
		brokerageNumber: "BR-999",
		brokerageName: "Different Brokerage Inc.",
		licenseType: "agent",
		province: "ON",
		status: "active",
	},
] as const;

function trimToUndefined(value: string | null | undefined) {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

export function normalizeFsraIdentifier(value: string): string {
	return value.trim().toUpperCase();
}

export function normalizeOptionalFsraIdentifier(
	value: string | null | undefined
): string | null {
	const normalized = value ? normalizeFsraIdentifier(value) : "";
	return normalized || null;
}

export function computeFsraFreshness(args: {
	freshnessWindowMs?: number;
	now: number;
	sourceImportedAt: number;
}): BrokerOnboardingRegulatorFreshness {
	const freshnessWindowMs =
		args.freshnessWindowMs ??
		DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG.regulatorFreshnessWindowMs;
	return args.now - args.sourceImportedAt > freshnessWindowMs
		? "stale"
		: "fresh";
}

function buildDefaultRawRecord(
	template: FsraFixtureTemplate
): BrokerOnboardingRegulatorSourceSnapshot {
	return {
		brokerageName: template.brokerageName ?? null,
		brokerageNumber: template.brokerageNumber ?? null,
		licenseNumber: template.licenseNumber,
		licenseType: template.licenseType,
		licenseeFullName: template.licenseeFullName,
		province: template.province,
		status: template.status,
	};
}

export function buildDefaultFsraSourceRecords(
	now = Date.now()
): FsraSourceRecord[] {
	return DEFAULT_FSRA_FIXTURE_TEMPLATES.map((template) => ({
		brokerageName: trimToUndefined(template.brokerageName) ?? null,
		brokerageNumber: trimToUndefined(template.brokerageNumber) ?? null,
		lastVerifiedAt: now - (template.lastVerifiedAtOffsetMs ?? 0),
		licenseNumber: normalizeFsraIdentifier(template.licenseNumber),
		licenseType: template.licenseType,
		licenseeFullName: template.licenseeFullName.trim(),
		province: normalizeBrokerOnboardingProvince(template.province),
		rawRecord: template.rawRecord ?? buildDefaultRawRecord(template),
		sourceImportedAt: now - (template.sourceImportedAtOffsetMs ?? 0),
		status: template.status,
	}));
}

export function findFsraSourceRecordByLicenseNumber(
	records: readonly FsraSourceRecord[],
	licenseNumber: string,
	province: string
): FsraSourceRecord | null {
	const normalizedLicenseNumber = normalizeFsraIdentifier(licenseNumber);
	const normalizedProvince = normalizeBrokerOnboardingProvince(province);

	return (
		records.find(
			(record) =>
				record.licenseNumber === normalizedLicenseNumber &&
				record.province === normalizedProvince
		) ?? null
	);
}

export function findFsraSourceRecordsByBrokerageNumber(
	records: readonly FsraSourceRecord[],
	brokerageNumber: string,
	province: string
): FsraSourceRecord[] {
	const normalizedBrokerageNumber = normalizeFsraIdentifier(brokerageNumber);
	const normalizedProvince = normalizeBrokerOnboardingProvince(province);

	return records.filter(
		(record) =>
			record.province === normalizedProvince &&
			(record.brokerageNumber ??
				(record.licenseType === "brokerage" ? record.licenseNumber : null)) ===
				normalizedBrokerageNumber
	);
}

export function selectPrimaryBrokerageRecord(
	records: readonly FsraSourceRecord[]
): FsraSourceRecord | null {
	if (records.length === 0) {
		return null;
	}

	return (
		records.find((record) => record.licenseType === "brokerage") ??
		records.find((record) => record.status === "active") ??
		records[0]
	);
}
