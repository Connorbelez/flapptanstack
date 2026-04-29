import { v } from "convex/values";

export const fsraLicenseTypeValidator = v.union(
	v.literal("agent"),
	v.literal("broker"),
	v.literal("principal_broker"),
	v.literal("brokerage")
);

export const fsraLicenseStatusValidator = v.union(
	v.literal("active"),
	v.literal("inactive"),
	v.literal("suspended"),
	v.literal("revoked")
);

export const fsraImportRunStatusValidator = v.union(
	v.literal("running"),
	v.literal("success"),
	v.literal("failed")
);

export const fsraImportTriggerValidator = v.union(
	v.literal("cron"),
	v.literal("manual")
);

export const brokerOnboardingVerificationCallbackProcessingStatusValidator =
	v.union(v.literal("pending"), v.literal("processed"), v.literal("failed"));

export const brokerOnboardingVerificationCallbackHeadersValidator = v.record(
	v.string(),
	v.string()
);

export const fsraRawRecordValidator = v.record(
	v.string(),
	v.union(v.string(), v.null())
);

export const fsraSourceRecordFields = {
	brokerageName: v.optional(v.union(v.string(), v.null())),
	brokerageNumber: v.optional(v.union(v.string(), v.null())),
	lastVerifiedAt: v.number(),
	licenseNumber: v.string(),
	licenseType: fsraLicenseTypeValidator,
	licenseeFullName: v.string(),
	province: v.string(),
	rawRecord: fsraRawRecordValidator,
	sourceImportedAt: v.number(),
	status: fsraLicenseStatusValidator,
} as const;

export const fsraSourceRecordValidator = v.object(fsraSourceRecordFields);
