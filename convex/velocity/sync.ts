import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { adminAction, convex } from "../fluent";
import { appendVelocityPackageAuditEntry } from "./audit";
import {
	fetchVelocityFullDealByLoanCode,
	isVelocityFullDealFetchError,
	resolveVelocityClientConfig,
	sha256Hex,
} from "./client";
import {
	buildVelocitySyncIdempotencyKey,
	getVelocityCanadianProvince,
	getVelocityDealStatusLabel,
	getVelocityPaymentFrequencyLabel,
	isUnsupportedVelocityPaymentFrequency,
	mapVelocityPaymentFrequencyToFairLend,
	mapVelocityRateTypeToFairLend,
	resolveVelocityStatusSemantics,
	VELOCITY_CORE_SOURCE_VERSION,
	VELOCITY_MORTGAGE_REQUEST_PURPOSE,
	VELOCITY_PROPERTY_INTENDED_USE,
	VELOCITY_RATE_TYPE,
	type VelocitySyncTrigger,
} from "./constants";
import type {
	VelocityConnectorCredentialContext,
	VelocityDeal,
	VelocityFairLendEnrichmentV1,
	VelocityNormalizedCoreV1,
	VelocityPackageAuditEventType,
	VelocityReadinessBlockerV1,
	VelocityReadinessV1,
	VelocityWebhookAgent,
} from "./contracts";

type VelocityWorkspace = Doc<"velocityPackageWorkspaces">;

export interface ProcessVelocityFullDealSyncArgs {
	dealHref?: string;
	expectedLinkApplicationId?: string;
	expectedWorkspaceId?: Id<"velocityPackageWorkspaces">;
	loanCode: string;
	trigger: VelocitySyncTrigger;
	webhookAgent?: VelocityWebhookAgent;
	webhookCredentialContext?: VelocityConnectorCredentialContext;
	webhookEventId?: Id<"velocityWebhookEvents">;
}

export interface VelocityFullDealSyncResult {
	result: "duplicate_noop" | "exception" | "failed" | "succeeded";
	syncAttemptId?: Id<"velocitySyncAttempts">;
	workspaceId?: Id<"velocityPackageWorkspaces">;
}

type ProcessVelocityFullDealSyncReferenceArgs = Record<string, unknown> &
	ProcessVelocityFullDealSyncArgs;
type ApplyVelocityFullDealSyncReferenceArgs = Record<string, unknown> &
	ApplyVelocityFullDealSyncArgs;
type RecordVelocitySyncFailureReferenceArgs = Record<string, unknown> &
	RecordVelocitySyncFailureArgs;

interface ApplyVelocityFullDealSyncArgs
	extends ProcessVelocityFullDealSyncArgs {
	fetchCredentialContext: VelocityConnectorCredentialContext;
	rawDeal: VelocityDeal;
	rawResponseBody: string;
	request: Record<string, unknown>;
	responseStatus: number;
	startedAt: number;
}

interface RecordVelocitySyncFailureArgs
	extends ProcessVelocityFullDealSyncArgs {
	error: string;
	fetchCredentialContext?: VelocityConnectorCredentialContext;
	rawResponseBody?: string;
	request: Record<string, unknown>;
	responseStatus?: number;
	startedAt: number;
}

const optionalNullableString = v.optional(v.union(v.string(), v.null()));

const credentialContextValidator = v.object({
	apiKeyFingerprint: v.optional(v.string()),
	credentialId: v.optional(v.string()),
	email: optionalNullableString,
	firmCode: optionalNullableString,
	provider: v.literal("velocity"),
	scope: v.optional(v.string()),
	tenantId: optionalNullableString,
	usedFor: v.union(
		v.literal("webhook_ingress"),
		v.literal("full_deal_fetch"),
		v.literal("search_deals")
	),
	username: optionalNullableString,
});

const webhookAgentValidator = v.object({
	email: optionalNullableString,
	firmCode: optionalNullableString,
	firstName: optionalNullableString,
	lastName: optionalNullableString,
	tenantId: optionalNullableString,
	username: optionalNullableString,
});

const syncTriggerValidator = v.union(
	v.literal("webhook"),
	v.literal("manual_sync_now"),
	v.literal("mock_scenario"),
	v.literal("retry")
);

const processVelocityFullDealSyncReference = makeFunctionReference<
	"action",
	ProcessVelocityFullDealSyncReferenceArgs,
	Promise<VelocityFullDealSyncResult>
>("velocity/sync:processVelocityFullDealSync");

const applyVelocityFullDealSyncReference = makeFunctionReference<
	"mutation",
	ApplyVelocityFullDealSyncReferenceArgs,
	Promise<VelocityFullDealSyncResult>
>("velocity/sync:applyVelocityFullDealSync");

const recordVelocitySyncFailureReference = makeFunctionReference<
	"mutation",
	RecordVelocitySyncFailureReferenceArgs,
	Promise<VelocityFullDealSyncResult>
>("velocity/sync:recordVelocitySyncFailure");

const getVelocityWorkspaceSyncLocatorReference = makeFunctionReference<
	"query",
	{ workspaceId: Id<"velocityPackageWorkspaces"> },
	Promise<{
		linkApplicationId: string;
		loanCode: string;
		workspaceId: Id<"velocityPackageWorkspaces">;
	}>
>("velocity/sync:getVelocityWorkspaceSyncLocator");

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanValue(value: unknown) {
	return typeof value === "boolean" ? value : null;
}

function arrayValue(value: unknown) {
	return Array.isArray(value) ? value : [];
}

export function stableVelocityJsonStringify(value: unknown): string {
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value);
	}

	if (Array.isArray(value)) {
		return `[${value.map((entry) => stableVelocityJsonStringify(entry)).join(",")}]`;
	}

	const record = value as Record<string, unknown>;
	return `{${Object.keys(record)
		.sort()
		.map(
			(key) =>
				`${JSON.stringify(key)}:${stableVelocityJsonStringify(record[key])}`
		)
		.join(",")}}`;
}

export async function hashStableVelocityJson(value: unknown) {
	const input = stableVelocityJsonStringify(value);
	return await sha256Hex(input);
}

function firstRecord(value: unknown) {
	return arrayValue(value).find(isRecord) ?? null;
}

function normalizeBorrower(value: unknown) {
	const borrower = isRecord(value) ? value : {};
	const firstName = stringValue(borrower.firstName);
	const lastName = stringValue(borrower.lastName);
	const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

	return {
		businessPhone: stringValue(borrower.businessPhone),
		cellPhone: stringValue(borrower.cellPhone),
		creditScore: numberValue(borrower.creditScore),
		dateOfBirth: stringValue(borrower.dateOfBirth),
		email: stringValue(borrower.email),
		firstName,
		fullName: fullName || "Unknown borrower",
		homePhone: stringValue(borrower.homePhone),
		lastName,
		mailingAddress: isRecord(borrower.mailingAddress)
			? borrower.mailingAddress
			: null,
		primaryAddress: firstRecord(borrower.addresses),
	};
}

function normalizeConditions(value: unknown) {
	return arrayValue(value)
		.filter(isRecord)
		.map((condition) => ({
			isApproved: booleanValue(condition.isApproved) ?? undefined,
			isSent: booleanValue(condition.isSent) ?? undefined,
			name: stringValue(condition.name) ?? "Unnamed condition",
		}));
}

function normalizeNotes(value: unknown) {
	return arrayValue(value)
		.filter(isRecord)
		.map((note) => ({
			dateCreated: stringValue(note.dateCreated),
			text: stringValue(note.text) ?? "",
		}))
		.filter((note) => note.text.length > 0);
}

function normalizeStringArray(value: unknown) {
	return arrayValue(value)
		.map((entry) => stringValue(entry))
		.filter((entry): entry is string => entry !== null);
}

export async function buildVelocityNormalizedCore(
	deal: VelocityDeal,
	fallbackLoanCode: string
): Promise<{
	core?: VelocityNormalizedCoreV1;
	error?: string;
	fieldPath?: string;
}> {
	const linkApplicationId = stringValue(deal.linkApplicationId);
	if (!linkApplicationId) {
		return {
			error: "Velocity deal is missing linkApplicationId",
			fieldPath: "linkApplicationId",
		};
	}

	const loanCode = stringValue(deal.loanCode) ?? fallbackLoanCode;
	if (!loanCode) {
		return {
			error: "Velocity deal is missing loanCode",
			fieldPath: "loanCode",
		};
	}

	const rawDealHash = await hashStableVelocityJson(deal);
	const subjectProperty = isRecord(deal.subjectProperty)
		? deal.subjectProperty
		: {};
	const mortgageRequest = isRecord(deal.mortgageRequest)
		? deal.mortgageRequest
		: {};
	const statusCode = numberValue(deal.status);
	const paymentFrequencyCode = numberValue(mortgageRequest.paymentFrequency);
	const rateTypeCode = numberValue(mortgageRequest.rateType);
	const purposeCode = numberValue(mortgageRequest.purpose);
	const intendedUseCode = numberValue(subjectProperty.intendedUse);
	const mortgageAmount = firstRecord(mortgageRequest.mortgages)?.amount;

	const coreWithoutHash = {
		borrowers: arrayValue(deal.borrowers).map(normalizeBorrower),
		conditions: normalizeConditions(deal.conditions),
		identity: {
			customSource: stringValue(deal.customSource),
			lenderReferenceNumber: stringValue(deal.lenderReferenceNumber),
			linkApplicationId,
			loanCode,
		},
		lenderConditions: normalizeStringArray(deal.lenderConditions),
		mortgageRequest: {
			amortization: numberValue(mortgageRequest.amortization),
			amortizationMonths: numberValue(mortgageRequest.amortizationMonths),
			buyDownRate: numberValue(mortgageRequest.buyDownRate),
			discountRate: numberValue(mortgageRequest.discountRate),
			fairlendPaymentFrequency:
				mapVelocityPaymentFrequencyToFairLend(paymentFrequencyCode),
			fairlendRateType: mapVelocityRateTypeToFairLend(rateTypeCode),
			firstPaymentDate: stringValue(mortgageRequest.firstPaymentDate),
			interestAdjustmentDate: stringValue(
				mortgageRequest.interestAdjustmentDate
			),
			lenderName: stringValue(mortgageRequest.lenderName),
			maturityDate: stringValue(mortgageRequest.maturityDate),
			netRate: numberValue(mortgageRequest.netRate),
			paymentAmount: numberValue(mortgageRequest.payment),
			paymentFrequencyCode,
			paymentFrequencyLabel:
				getVelocityPaymentFrequencyLabel(paymentFrequencyCode),
			premiumRate: numberValue(mortgageRequest.premiumRate),
			purposeCode,
			purposeLabel:
				purposeCode == null
					? null
					: (VELOCITY_MORTGAGE_REQUEST_PURPOSE[
							purposeCode as keyof typeof VELOCITY_MORTGAGE_REQUEST_PURPOSE
						] ?? null),
			rate: numberValue(mortgageRequest.rate),
			rateTypeCode,
			rateTypeLabel:
				rateTypeCode == null
					? null
					: (VELOCITY_RATE_TYPE[
							rateTypeCode as keyof typeof VELOCITY_RATE_TYPE
						] ?? null),
			requestedPrincipal: numberValue(mortgageAmount),
			termInMonths: numberValue(mortgageRequest.termInMonths),
		},
		notes: normalizeNotes(deal.notes),
		rawDealHash,
		referral: isRecord(deal.referral) ? deal.referral : null,
		solicitor: isRecord(deal.solicitor) ? deal.solicitor : null,
		sourceVersion: VELOCITY_CORE_SOURCE_VERSION,
		subjectProperty: {
			city: stringValue(subjectProperty.city),
			constructionType: stringValue(subjectProperty.constructionType),
			intendedUseCode,
			intendedUseLabel:
				intendedUseCode == null
					? null
					: (VELOCITY_PROPERTY_INTENDED_USE[
							intendedUseCode as keyof typeof VELOCITY_PROPERTY_INTENDED_USE
						] ?? null),
			postalCode: stringValue(subjectProperty.postalCode),
			propertyTypeRaw: stringValue(subjectProperty.propertyType),
			province: getVelocityCanadianProvince(
				numberValue(subjectProperty.province)
			),
			provinceCode: numberValue(subjectProperty.province),
			purchasePrice: numberValue(subjectProperty.purchasePrice),
			streetDirectionCode: numberValue(subjectProperty.streetDirection),
			streetName: stringValue(subjectProperty.streetName),
			streetNumber: stringValue(subjectProperty.streetNumber),
			streetTypeCode: numberValue(subjectProperty.streetType),
			tenure: stringValue(subjectProperty.tenure),
			unit: stringValue(subjectProperty.unitNumber),
		},
		upstream: {
			agent: stringValue(deal.agent),
			closingDate: stringValue(deal.closingDate),
			dateCreated: stringValue(deal.dateCreated),
			isConfirmedCompliant: booleanValue(deal.isConfirmedCompliant),
			statusCode,
			statusLabel: getVelocityDealStatusLabel(statusCode),
		},
	} satisfies Omit<VelocityNormalizedCoreV1, "normalizedHash">;

	return {
		core: {
			...coreWithoutHash,
			normalizedHash: await hashStableVelocityJson(coreWithoutHash),
		},
	};
}

function hasCompleteBankInput(enrichment: VelocityFairLendEnrichmentV1) {
	const bank = enrichment.bankInput;
	return Boolean(
		bank?.institutionNumber &&
			bank.transitNumber &&
			bank.accountNumber &&
			bank.accountHolderName
	);
}

function blocker(args: VelocityReadinessBlockerV1) {
	return args;
}

function buildRequiredCoreBlockers(core: VelocityNormalizedCoreV1) {
	const requiredFields: Array<{
		fieldPath: string;
		label: string;
		value: number | string | null | undefined;
	}> = [
		{
			fieldPath: "mortgageRequest.requestedPrincipal",
			label: "principal",
			value: core.mortgageRequest.requestedPrincipal,
		},
		{
			fieldPath: "mortgageRequest.rate",
			label: "interest rate",
			value: core.mortgageRequest.rate,
		},
		{
			fieldPath: "mortgageRequest.fairlendRateType",
			label: "rate type",
			value: core.mortgageRequest.fairlendRateType,
		},
		{
			fieldPath: "mortgageRequest.termInMonths",
			label: "term months",
			value: core.mortgageRequest.termInMonths,
		},
		{
			fieldPath: "mortgageRequest.amortizationMonths",
			label: "amortization months",
			value: core.mortgageRequest.amortizationMonths,
		},
		{
			fieldPath: "mortgageRequest.paymentAmount",
			label: "payment amount",
			value: core.mortgageRequest.paymentAmount,
		},
		{
			fieldPath: "mortgageRequest.fairlendPaymentFrequency",
			label: "payment frequency",
			value: core.mortgageRequest.fairlendPaymentFrequency,
		},
		{
			fieldPath: "mortgageRequest.interestAdjustmentDate",
			label: "interest adjustment date",
			value: core.mortgageRequest.interestAdjustmentDate,
		},
		{
			fieldPath: "mortgageRequest.maturityDate",
			label: "maturity date",
			value: core.mortgageRequest.maturityDate,
		},
		{
			fieldPath: "mortgageRequest.firstPaymentDate",
			label: "first payment date",
			value: core.mortgageRequest.firstPaymentDate,
		},
		{
			fieldPath: "subjectProperty.city",
			label: "property city",
			value: core.subjectProperty.city,
		},
		{
			fieldPath: "subjectProperty.province",
			label: "property province",
			value: core.subjectProperty.province,
		},
		{
			fieldPath: "subjectProperty.postalCode",
			label: "property postal code",
			value: core.subjectProperty.postalCode,
		},
	];

	return requiredFields
		.filter((field) => field.value == null || field.value === "")
		.map((field) =>
			blocker({
				code: "missing_required_core_field",
				fieldPath: field.fieldPath,
				message: `Velocity full deal is missing required activation field: ${field.label}.`,
				severity: "blocking",
				source: "velocity",
			})
		);
}

export function computeVelocityReadiness(args: {
	core: VelocityNormalizedCoreV1;
	enrichment: VelocityFairLendEnrichmentV1;
	workspace?: VelocityWorkspace;
}): VelocityReadinessV1 {
	const blockers: VelocityReadinessBlockerV1[] = [];
	const statusSemantics = resolveVelocityStatusSemantics({
		fairlendActivated: Boolean(args.workspace?.activation?.mortgageId),
		statusCode: args.core.upstream.statusCode,
	});

	if (statusSemantics.blockerCode) {
		blockers.push(
			blocker({
				code: statusSemantics.blockerCode,
				fieldPath: "upstream.statusCode",
				message: `Velocity status ${statusSemantics.statusLabel ?? "unknown"} is not activation-ready for v1.`,
				severity: "blocking",
				source: "velocity",
			})
		);
	}

	if (
		isUnsupportedVelocityPaymentFrequency(
			args.core.mortgageRequest.paymentFrequencyCode
		)
	) {
		blockers.push(
			blocker({
				code: "unsupported_payment_frequency",
				fieldPath: "mortgageRequest.paymentFrequencyCode",
				message: `Velocity payment frequency ${
					args.core.mortgageRequest.paymentFrequencyLabel ??
					args.core.mortgageRequest.paymentFrequencyCode
				} is unsupported in v1.`,
				severity: "blocking",
				source: "velocity",
			})
		);
	}

	blockers.push(...buildRequiredCoreBlockers(args.core));

	if (!hasCompleteBankInput(args.enrichment)) {
		blockers.push(
			blocker({
				code: "missing_bank_data",
				fieldPath: "fairlendEnrichment.bankInput",
				message: "FairLend bank input is required before activation.",
				severity: "blocking",
				source: "fairlend",
			})
		);
	}

	if (!args.enrichment.padEvidence) {
		blockers.push(
			blocker({
				code: "missing_pad_pdf",
				fieldPath: "fairlendEnrichment.padEvidence",
				message: "PAD PDF evidence is required before activation.",
				severity: "blocking",
				source: "fairlend",
			})
		);
	}

	if (!args.enrichment.activationRemediation?.loanType) {
		blockers.push(
			blocker({
				code: "missing_fairlend_owned_field",
				fieldPath: "fairlendEnrichment.activationRemediation.loanType",
				message: "FairLend-owned loan type is required before activation.",
				severity: "blocking",
				source: "fairlend",
			})
		);
	}

	if (args.enrichment.activationRemediation?.lienPosition == null) {
		blockers.push(
			blocker({
				code: "missing_fairlend_owned_field",
				fieldPath: "fairlendEnrichment.activationRemediation.lienPosition",
				message: "FairLend-owned lien position is required before activation.",
				severity: "blocking",
				source: "fairlend",
			})
		);
	}

	if (
		args.workspace?.finalReview &&
		args.workspace.finalReview.reviewedSnapshotHash !== args.core.normalizedHash
	) {
		blockers.push(
			blocker({
				code: "upstream_changed_after_review",
				fieldPath: "normalizedCoreHash",
				message: "Velocity-owned core data changed after final review.",
				severity: "blocking",
				source: "system",
			})
		);
	}

	return {
		blockers,
		canActivate:
			blockers.length === 0 &&
			statusSemantics.canActivate &&
			Boolean(args.workspace?.finalReview),
		canFinalReview: blockers.length === 0,
		warnings: [],
	};
}

function resolveWorkspaceState(args: {
	readiness: VelocityReadinessV1;
	workspace?: VelocityWorkspace;
}) {
	if (args.workspace?.activation?.mortgageId) {
		return "activated" as const;
	}
	if (
		args.readiness.blockers.some(
			(readinessBlocker) =>
				readinessBlocker.code === "upstream_changed_after_review"
		)
	) {
		return "final_review_required" as const;
	}
	if (args.readiness.canActivate) {
		return "ready_to_activate" as const;
	}
	if (args.readiness.canFinalReview) {
		return "ready_for_review" as const;
	}
	if (
		args.readiness.blockers.some(
			(readinessBlocker) => readinessBlocker.source === "fairlend"
		)
	) {
		return "needs_fairlend_data" as const;
	}
	return "in_progress" as const;
}

function exceptionForBlocker(readinessBlocker: VelocityReadinessBlockerV1) {
	if (
		readinessBlocker.code === "missing_link_application_id" ||
		readinessBlocker.code === "identity_collision"
	) {
		return {
			kind: "identity_exception" as const,
			severity: "critical" as const,
			title:
				readinessBlocker.code === "identity_collision"
					? "Velocity identity collision"
					: "Missing Velocity linkApplicationId",
		};
	}
	if (readinessBlocker.code === "unsupported_payment_frequency") {
		return {
			kind: "unsupported_mapping_exception" as const,
			severity: "blocking" as const,
			title: "Unsupported Velocity mapping",
		};
	}
	if (readinessBlocker.code === "upstream_changed_after_review") {
		return {
			kind: "upstream_changed_after_review" as const,
			severity: "blocking" as const,
			title: "Velocity data changed after review",
		};
	}
	if (
		readinessBlocker.code === "missing_required_core_field" ||
		readinessBlocker.code === "velocity_complete_before_activation" ||
		readinessBlocker.code === "unsupported_velocity_status"
	) {
		return {
			kind: "upstream_sync_exception" as const,
			severity: "blocking" as const,
			title: "Velocity sync blocker",
		};
	}
	return null;
}

function exceptionFingerprint(
	exceptionKind: string,
	readinessBlocker: VelocityReadinessBlockerV1
) {
	return [
		exceptionKind,
		readinessBlocker.code,
		readinessBlocker.fieldPath ?? "root",
	].join(":");
}

function exceptionDetailsWithFingerprint(args: {
	blocker: VelocityReadinessBlockerV1;
	details: Record<string, unknown>;
	exceptionKind: string;
}) {
	return {
		...args.details,
		blockerCode: args.blocker.code,
		exceptionFingerprint: exceptionFingerprint(
			args.exceptionKind,
			args.blocker
		),
		fieldPath: args.blocker.fieldPath,
	};
}

async function openOrUpdateException(
	ctx: MutationCtx,
	args: {
		blocker: VelocityReadinessBlockerV1;
		details: Record<string, unknown>;
		sourceSyncAttemptId?: Id<"velocitySyncAttempts">;
		sourceWebhookEventId?: Id<"velocityWebhookEvents">;
		workspaceId?: Id<"velocityPackageWorkspaces">;
	}
) {
	const exception = exceptionForBlocker(args.blocker);
	if (!exception) {
		return null;
	}

	const details = exceptionDetailsWithFingerprint({
		blocker: args.blocker,
		details: args.details,
		exceptionKind: exception.kind,
	});
	const fingerprint = details.exceptionFingerprint;
	const existing = args.workspaceId
		? (
				await ctx.db
					.query("velocityPackageExceptions")
					.withIndex("by_workspace_status", (query) =>
						query.eq("workspaceId", args.workspaceId).eq("status", "open")
					)
					.collect()
			).find(
				(row) =>
					row.kind === exception.kind &&
					isRecord(row.details) &&
					row.details.exceptionFingerprint === fingerprint
			)
		: null;

	if (existing) {
		await ctx.db.patch(existing._id, {
			details,
			message: args.blocker.message,
			sourceSyncAttemptId: args.sourceSyncAttemptId,
			sourceWebhookEventId: args.sourceWebhookEventId,
		});
		return existing._id;
	}

	return await ctx.db.insert("velocityPackageExceptions", {
		details,
		kind: exception.kind,
		message: args.blocker.message,
		openedAt: Date.now(),
		severity: exception.severity,
		sourceSyncAttemptId: args.sourceSyncAttemptId,
		sourceWebhookEventId: args.sourceWebhookEventId,
		status: "open",
		title: exception.title,
		workspaceId: args.workspaceId,
	});
}

async function supersedeStaleFingerprintExceptions(
	ctx: MutationCtx,
	args: {
		activeFingerprints: Set<string>;
		now: number;
		sourceSyncAttemptId: Id<"velocitySyncAttempts">;
		workspaceId: Id<"velocityPackageWorkspaces">;
	}
) {
	const openExceptions = await ctx.db
		.query("velocityPackageExceptions")
		.withIndex("by_workspace_status", (query) =>
			query.eq("workspaceId", args.workspaceId).eq("status", "open")
		)
		.collect();

	for (const openException of openExceptions) {
		const fingerprint = isRecord(openException.details)
			? openException.details.exceptionFingerprint
			: undefined;
		if (
			typeof fingerprint === "string" &&
			!args.activeFingerprints.has(fingerprint)
		) {
			await ctx.db.patch(openException._id, {
				resolvedAt: args.now,
				sourceSyncAttemptId: args.sourceSyncAttemptId,
				status: "superseded",
			});
		}
	}
}

async function patchWebhookEvent(
	ctx: MutationCtx,
	args: {
		error?: string;
		status: "failed" | "processed";
		webhookEventId?: Id<"velocityWebhookEvents">;
		workspaceId?: Id<"velocityPackageWorkspaces">;
	}
) {
	if (!args.webhookEventId) {
		return;
	}

	const existing = await ctx.db.get(args.webhookEventId);
	if (!existing) {
		return;
	}

	await ctx.db.patch(args.webhookEventId, {
		attempts: existing.attempts + 1,
		error: args.error,
		processedAt: Date.now(),
		status: args.status,
		workspaceId: args.workspaceId,
	});
}

async function appendSyncAuditEntries(
	ctx: MutationCtx,
	args: {
		connectorCredentialContext: VelocityConnectorCredentialContext;
		core: VelocityNormalizedCoreV1;
		previousState?: string;
		readiness: VelocityReadinessV1;
		snapshotId?: Id<"velocityPackageSnapshots">;
		syncAttemptId: Id<"velocitySyncAttempts">;
		webhookAgent?: VelocityWebhookAgent;
		webhookCredentialContext?: VelocityConnectorCredentialContext;
		webhookEventId?: Id<"velocityWebhookEvents">;
		workspaceId: Id<"velocityPackageWorkspaces">;
	}
) {
	const eventTypes: VelocityPackageAuditEventType[] = [
		"velocity_full_deal_fetch_attempted",
		"velocity_normalized",
		"velocity_identity_validated",
		"velocity_readiness_recomputed",
	];

	for (const eventType of eventTypes) {
		await appendVelocityPackageAuditEntry(ctx, {
			actorId: args.webhookAgent?.email ?? "velocity_sync_system",
			actorType: "system",
			channel: args.webhookEventId ? "api_webhook" : "scheduler",
			connectorCredentialContext: args.connectorCredentialContext,
			eventType,
			idempotencyKey: `${eventType}:${String(args.syncAttemptId)}`,
			linkedRecordIds: {
				snapshotId: args.snapshotId ? String(args.snapshotId) : undefined,
				syncAttemptId: String(args.syncAttemptId),
				webhookEventId: args.webhookEventId
					? String(args.webhookEventId)
					: undefined,
			},
			payload: {
				linkApplicationId: args.core.identity.linkApplicationId,
				loanCode: args.core.identity.loanCode,
				normalizedCoreHash: args.core.normalizedHash,
				rawDealHash: args.core.rawDealHash,
				snapshotId: args.snapshotId ? String(args.snapshotId) : undefined,
				syncAttemptId: String(args.syncAttemptId),
			},
			previousState: args.previousState,
			readiness: args.readiness,
			webhookAgent: args.webhookAgent,
			workspaceId: args.workspaceId,
		});
	}
}

function fallbackVelocityAuditWorkspaceId(args: {
	linkApplicationId?: string;
	loanCode?: string;
	workspaceId?: Id<"velocityPackageWorkspaces">;
}) {
	return (
		args.workspaceId ??
		`velocity_unmatched:${args.linkApplicationId ?? args.loanCode ?? "unknown"}`
	);
}

async function appendSyncFailureAuditEntry(
	ctx: MutationCtx,
	args: {
		error: string;
		fetchCredentialContext?: VelocityConnectorCredentialContext;
		loanCode: string;
		syncAttemptId: Id<"velocitySyncAttempts">;
		webhookAgent?: VelocityWebhookAgent;
		webhookCredentialContext?: VelocityConnectorCredentialContext;
		webhookEventId?: Id<"velocityWebhookEvents">;
		workspaceId?: Id<"velocityPackageWorkspaces">;
	}
) {
	await appendVelocityPackageAuditEntry(ctx, {
		actorId: args.webhookAgent?.email ?? "velocity_sync_system",
		actorType: "system",
		channel: args.webhookEventId ? "api_webhook" : "scheduler",
		connectorCredentialContext:
			args.fetchCredentialContext ?? args.webhookCredentialContext,
		eventType: "velocity_full_deal_fetch_failed",
		idempotencyKey: `velocity_full_deal_fetch_failed:${String(
			args.syncAttemptId
		)}`,
		linkedRecordIds: {
			syncAttemptId: String(args.syncAttemptId),
			webhookEventId: args.webhookEventId
				? String(args.webhookEventId)
				: undefined,
		},
		outcome: "rejected",
		payload: {
			error: args.error,
			loanCode: args.loanCode,
			syncAttemptId: String(args.syncAttemptId),
		},
		reason: args.error,
		webhookAgent: args.webhookAgent,
		workspaceId: fallbackVelocityAuditWorkspaceId(args),
	});
}

async function appendIdentityExceptionAuditEntry(
	ctx: MutationCtx,
	args: {
		blocker: VelocityReadinessBlockerV1;
		connectorCredentialContext: VelocityConnectorCredentialContext;
		linkApplicationId?: string;
		loanCode: string;
		syncAttemptId: Id<"velocitySyncAttempts">;
		webhookAgent?: VelocityWebhookAgent;
		webhookCredentialContext?: VelocityConnectorCredentialContext;
		webhookEventId?: Id<"velocityWebhookEvents">;
		workspaceId?: Id<"velocityPackageWorkspaces">;
	}
) {
	await appendVelocityPackageAuditEntry(ctx, {
		actorId: args.webhookAgent?.email ?? "velocity_sync_system",
		actorType: "system",
		channel: args.webhookEventId ? "api_webhook" : "scheduler",
		connectorCredentialContext: args.connectorCredentialContext,
		eventType: "velocity_identity_exception_opened",
		idempotencyKey: `velocity_identity_exception_opened:${String(
			args.syncAttemptId
		)}`,
		linkedRecordIds: {
			syncAttemptId: String(args.syncAttemptId),
			webhookEventId: args.webhookEventId
				? String(args.webhookEventId)
				: undefined,
		},
		outcome: "rejected",
		payload: {
			blocker: args.blocker,
			linkApplicationId: args.linkApplicationId,
			loanCode: args.loanCode,
			syncAttemptId: String(args.syncAttemptId),
			webhookCredentialContext: args.webhookCredentialContext,
		},
		reason: args.blocker.message,
		webhookAgent: args.webhookAgent,
		workspaceId: fallbackVelocityAuditWorkspaceId(args),
	});
}

async function getWorkspaceByLinkApplicationId(
	ctx: MutationCtx,
	linkApplicationId: string
) {
	return await ctx.db
		.query("velocityPackageWorkspaces")
		.withIndex("by_link_application_id", (query) =>
			query.eq("linkApplicationId", linkApplicationId)
		)
		.collect();
}

async function recordVelocityIdentityMismatch(
	ctx: MutationCtx,
	args: {
		core: VelocityNormalizedCoreV1;
		now: number;
		sync: ApplyVelocityFullDealSyncArgs;
	}
): Promise<VelocityFullDealSyncResult> {
	const identityMismatchBlocker = blocker({
		code: "identity_collision",
		fieldPath: "linkApplicationId",
		message:
			"Velocity manual sync returned a different linkApplicationId than the selected workspace.",
		severity: "blocking",
		source: "system",
	});
	const syncAttemptId = await ctx.db.insert("velocitySyncAttempts", {
		completedAt: args.now,
		connectorCredentialContext: args.sync.fetchCredentialContext,
		dealHref: args.sync.dealHref,
		error: identityMismatchBlocker.message,
		idempotencyKey: `velocity:sync_identity_mismatch:${args.sync.expectedLinkApplicationId}:${args.core.rawDealHash}`,
		loanCode: args.core.identity.loanCode,
		normalizedCoreHash: args.core.normalizedHash,
		rawDealHash: args.core.rawDealHash,
		rawResponseBody: args.sync.rawResponseBody,
		request: args.sync.request,
		responseStatus: args.sync.responseStatus,
		result: "exception",
		startedAt: args.sync.startedAt,
		trigger: args.sync.trigger,
		workspaceId: args.sync.expectedWorkspaceId,
	});
	await openOrUpdateException(ctx, {
		blocker: identityMismatchBlocker,
		details: {
			actualLinkApplicationId: args.core.identity.linkApplicationId,
			expectedLinkApplicationId: args.sync.expectedLinkApplicationId,
			fetchCredentialContext: args.sync.fetchCredentialContext,
			loanCode: args.core.identity.loanCode,
			normalizedCoreHash: args.core.normalizedHash,
			rawDealHash: args.core.rawDealHash,
		},
		sourceSyncAttemptId: syncAttemptId,
		sourceWebhookEventId: args.sync.webhookEventId,
		workspaceId: args.sync.expectedWorkspaceId,
	});
	await appendIdentityExceptionAuditEntry(ctx, {
		blocker: identityMismatchBlocker,
		connectorCredentialContext: args.sync.fetchCredentialContext,
		linkApplicationId: args.core.identity.linkApplicationId,
		loanCode: args.core.identity.loanCode,
		syncAttemptId,
		webhookAgent: args.sync.webhookAgent,
		webhookCredentialContext: args.sync.webhookCredentialContext,
		webhookEventId: args.sync.webhookEventId,
		workspaceId: args.sync.expectedWorkspaceId,
	});
	return {
		result: "exception",
		syncAttemptId,
		workspaceId: args.sync.expectedWorkspaceId,
	};
}

async function replayExistingTerminalSyncAttempt(
	ctx: MutationCtx,
	args: {
		existingSync: Doc<"velocitySyncAttempts">;
		webhookEventId?: Id<"velocityWebhookEvents">;
	}
): Promise<VelocityFullDealSyncResult | null> {
	if (
		args.existingSync.workspaceId &&
		args.existingSync.result === "succeeded"
	) {
		await patchWebhookEvent(ctx, {
			status: "processed",
			webhookEventId: args.webhookEventId,
			workspaceId: args.existingSync.workspaceId,
		});
		return {
			result: "duplicate_noop",
			syncAttemptId: args.existingSync._id,
			workspaceId: args.existingSync.workspaceId,
		};
	}
	if (
		args.existingSync.result === "exception" ||
		args.existingSync.result === "failed"
	) {
		await patchWebhookEvent(ctx, {
			error: args.existingSync.error ?? args.existingSync.result,
			status: "failed",
			webhookEventId: args.webhookEventId,
			workspaceId: args.existingSync.workspaceId,
		});
		return {
			result: args.existingSync.result,
			syncAttemptId: args.existingSync._id,
			workspaceId: args.existingSync.workspaceId,
		};
	}
	return null;
}

export const getVelocityWorkspaceSyncLocator = convex
	.query()
	.input({
		workspaceId: v.id("velocityPackageWorkspaces"),
	})
	.handler(async (ctx, args) => {
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new ConvexError("Velocity package workspace not found");
		}

		return {
			linkApplicationId: workspace.linkApplicationId,
			loanCode: workspace.loanCode,
			workspaceId: workspace._id,
		};
	})
	.internal();

export const processVelocityFullDealSync = convex
	.action()
	.input({
		dealHref: v.optional(v.string()),
		expectedLinkApplicationId: v.optional(v.string()),
		expectedWorkspaceId: v.optional(v.id("velocityPackageWorkspaces")),
		loanCode: v.string(),
		trigger: syncTriggerValidator,
		webhookAgent: v.optional(webhookAgentValidator),
		webhookCredentialContext: v.optional(credentialContextValidator),
		webhookEventId: v.optional(v.id("velocityWebhookEvents")),
	})
	.handler(async (ctx, args): Promise<VelocityFullDealSyncResult> => {
		const startedAt = Date.now();
		let fetchCredentialContext: VelocityConnectorCredentialContext | undefined;

		try {
			const config = await resolveVelocityClientConfig();
			fetchCredentialContext = config.credentialContext;
			const fullDeal = await fetchVelocityFullDealByLoanCode({
				config,
				dealHref: args.dealHref,
				loanCode: args.loanCode,
			});

			return await ctx.runMutation(applyVelocityFullDealSyncReference, {
				...args,
				fetchCredentialContext,
				rawDeal: fullDeal.deal,
				rawResponseBody: fullDeal.rawResponseBody,
				request: fullDeal.request,
				responseStatus: fullDeal.responseStatus,
				startedAt,
			});
		} catch (error) {
			const structuredError = isVelocityFullDealFetchError(error)
				? error
				: null;
			return await ctx.runMutation(recordVelocitySyncFailureReference, {
				...args,
				error: error instanceof Error ? error.message : "Velocity sync failed",
				fetchCredentialContext,
				rawResponseBody: structuredError?.rawResponseBody,
				request: structuredError?.request ?? {
					dealHref: args.dealHref,
					loanCode: args.loanCode,
					method: "GET",
				},
				responseStatus: structuredError?.responseStatus,
				startedAt,
			});
		}
	})
	.internal();

export const recordVelocitySyncFailure = convex
	.mutation()
	.input({
		dealHref: v.optional(v.string()),
		error: v.string(),
		expectedLinkApplicationId: v.optional(v.string()),
		expectedWorkspaceId: v.optional(v.id("velocityPackageWorkspaces")),
		fetchCredentialContext: v.optional(credentialContextValidator),
		loanCode: v.string(),
		rawResponseBody: v.optional(v.string()),
		request: v.record(v.string(), v.any()),
		responseStatus: v.optional(v.number()),
		startedAt: v.number(),
		trigger: syncTriggerValidator,
		webhookAgent: v.optional(webhookAgentValidator),
		webhookCredentialContext: v.optional(credentialContextValidator),
		webhookEventId: v.optional(v.id("velocityWebhookEvents")),
	})
	.handler(async (ctx, args): Promise<VelocityFullDealSyncResult> => {
		const syncAttemptId = await ctx.db.insert("velocitySyncAttempts", {
			completedAt: Date.now(),
			connectorCredentialContext: args.fetchCredentialContext,
			dealHref: args.dealHref,
			error: args.error,
			loanCode: args.loanCode,
			rawResponseBody: args.rawResponseBody,
			request: args.request,
			responseStatus: args.responseStatus,
			result: "failed",
			startedAt: args.startedAt,
			trigger: args.trigger,
			workspaceId: args.expectedWorkspaceId,
		});

		await appendSyncFailureAuditEntry(ctx, {
			error: args.error,
			fetchCredentialContext: args.fetchCredentialContext,
			loanCode: args.loanCode,
			syncAttemptId,
			webhookAgent: args.webhookAgent,
			webhookCredentialContext: args.webhookCredentialContext,
			webhookEventId: args.webhookEventId,
			workspaceId: args.expectedWorkspaceId,
		});

		await patchWebhookEvent(ctx, {
			error: args.error,
			status: "failed",
			webhookEventId: args.webhookEventId,
			workspaceId: args.expectedWorkspaceId,
		});

		return {
			result: "failed",
			syncAttemptId,
			workspaceId: args.expectedWorkspaceId,
		};
	})
	.internal();

export const applyVelocityFullDealSync = convex
	.mutation()
	.input({
		dealHref: v.optional(v.string()),
		expectedLinkApplicationId: v.optional(v.string()),
		expectedWorkspaceId: v.optional(v.id("velocityPackageWorkspaces")),
		fetchCredentialContext: credentialContextValidator,
		loanCode: v.string(),
		rawDeal: v.record(v.string(), v.any()),
		rawResponseBody: v.string(),
		request: v.record(v.string(), v.any()),
		responseStatus: v.number(),
		startedAt: v.number(),
		trigger: syncTriggerValidator,
		webhookAgent: v.optional(webhookAgentValidator),
		webhookCredentialContext: v.optional(credentialContextValidator),
		webhookEventId: v.optional(v.id("velocityWebhookEvents")),
	})
	.handler(async (ctx, args): Promise<VelocityFullDealSyncResult> => {
		const normalized = await buildVelocityNormalizedCore(
			args.rawDeal,
			args.loanCode
		);
		const now = Date.now();

		if (!normalized.core) {
			const identityBlocker = blocker({
				code: "missing_link_application_id",
				fieldPath: normalized.fieldPath,
				message:
					normalized.error ??
					"Velocity deal is missing required upstream identity.",
				severity: "blocking",
				source: "velocity",
			});
			const syncAttemptId = await ctx.db.insert("velocitySyncAttempts", {
				completedAt: now,
				connectorCredentialContext: args.fetchCredentialContext,
				dealHref: args.dealHref,
				error: normalized.error,
				loanCode: args.loanCode,
				rawDealHash: await hashStableVelocityJson(args.rawDeal),
				rawResponseBody: args.rawResponseBody,
				request: args.request,
				responseStatus: args.responseStatus,
				result: "exception",
				startedAt: args.startedAt,
				trigger: args.trigger,
			});
			await openOrUpdateException(ctx, {
				blocker: identityBlocker,
				details: {
					fetchCredentialContext: args.fetchCredentialContext,
					webhookAgent: args.webhookAgent,
					webhookCredentialContext: args.webhookCredentialContext,
				},
				sourceSyncAttemptId: syncAttemptId,
				sourceWebhookEventId: args.webhookEventId,
			});
			await appendIdentityExceptionAuditEntry(ctx, {
				blocker: identityBlocker,
				connectorCredentialContext: args.fetchCredentialContext,
				loanCode: args.loanCode,
				syncAttemptId,
				webhookAgent: args.webhookAgent,
				webhookCredentialContext: args.webhookCredentialContext,
				webhookEventId: args.webhookEventId,
				workspaceId: args.expectedWorkspaceId,
			});
			await patchWebhookEvent(ctx, {
				error: normalized.error,
				status: "failed",
				webhookEventId: args.webhookEventId,
			});
			return { result: "exception", syncAttemptId };
		}

		const core = normalized.core;
		if (
			args.expectedLinkApplicationId &&
			args.expectedLinkApplicationId !== core.identity.linkApplicationId
		) {
			return await recordVelocityIdentityMismatch(ctx, {
				core,
				now,
				sync: args,
			});
		}
		const syncIdempotencyKey = buildVelocitySyncIdempotencyKey({
			linkApplicationId: core.identity.linkApplicationId,
			rawDealHash: core.rawDealHash,
		});
		const existingSync = await ctx.db
			.query("velocitySyncAttempts")
			.withIndex("by_idempotency_key", (query) =>
				query.eq("idempotencyKey", syncIdempotencyKey)
			)
			.first();
		if (existingSync) {
			const replayedSync = await replayExistingTerminalSyncAttempt(ctx, {
				existingSync,
				webhookEventId: args.webhookEventId,
			});
			if (replayedSync) {
				return replayedSync;
			}
		}

		const matches = await getWorkspaceByLinkApplicationId(
			ctx,
			core.identity.linkApplicationId
		);
		const workspace = matches[0];
		if (matches.length > 1) {
			const identityCollisionBlocker = blocker({
				code: "identity_collision",
				fieldPath: "linkApplicationId",
				message:
					"Multiple Velocity package workspaces exist for the same linkApplicationId.",
				severity: "blocking",
				source: "system",
			});
			const syncAttemptId = await ctx.db.insert("velocitySyncAttempts", {
				completedAt: now,
				connectorCredentialContext: args.fetchCredentialContext,
				dealHref: args.dealHref,
				error: "Duplicate Velocity package workspaces for linkApplicationId",
				idempotencyKey: syncIdempotencyKey,
				loanCode: core.identity.loanCode,
				normalizedCoreHash: core.normalizedHash,
				rawDealHash: core.rawDealHash,
				rawResponseBody: args.rawResponseBody,
				request: args.request,
				responseStatus: args.responseStatus,
				result: "exception",
				startedAt: args.startedAt,
				trigger: args.trigger,
				workspaceId: workspace?._id,
			});
			await openOrUpdateException(ctx, {
				blocker: identityCollisionBlocker,
				details: {
					linkApplicationId: core.identity.linkApplicationId,
					matchingWorkspaceIds: matches.map((match) => String(match._id)),
					webhookAgent: args.webhookAgent,
					webhookCredentialContext: args.webhookCredentialContext,
				},
				sourceSyncAttemptId: syncAttemptId,
				sourceWebhookEventId: args.webhookEventId,
				workspaceId: workspace?._id,
			});
			await appendIdentityExceptionAuditEntry(ctx, {
				blocker: identityCollisionBlocker,
				connectorCredentialContext: args.fetchCredentialContext,
				linkApplicationId: core.identity.linkApplicationId,
				loanCode: core.identity.loanCode,
				syncAttemptId,
				webhookAgent: args.webhookAgent,
				webhookCredentialContext: args.webhookCredentialContext,
				webhookEventId: args.webhookEventId,
				workspaceId: workspace?._id,
			});
			await patchWebhookEvent(ctx, {
				error: "identity_collision",
				status: "failed",
				webhookEventId: args.webhookEventId,
				workspaceId: workspace?._id,
			});
			return {
				result: "exception",
				syncAttemptId,
				workspaceId: workspace?._id,
			};
		}

		const fairlendEnrichment = workspace?.fairlendEnrichment ?? {};
		const readiness = computeVelocityReadiness({
			core,
			enrichment: fairlendEnrichment,
			workspace,
		});
		const state = resolveWorkspaceState({ readiness, workspace });
		const exception = readiness.blockers
			.map(exceptionForBlocker)
			.find((candidate) => candidate !== null);
		const workspacePatch = {
			currentVelocityStatusCode: core.upstream.statusCode ?? undefined,
			currentVelocityStatusLabel: core.upstream.statusLabel ?? undefined,
			exceptionKind: exception?.kind,
			exceptionSummary: readiness.blockers[0]?.message,
			fairlendEnrichment,
			lenderReferenceNumber: core.identity.lenderReferenceNumber ?? undefined,
			loanCode: core.identity.loanCode,
			normalizedCore: core,
			normalizedCoreHash: core.normalizedHash,
			readiness,
			state,
			updatedAt: now,
		};
		const workspaceId =
			workspace?._id ??
			(await ctx.db.insert("velocityPackageWorkspaces", {
				...workspacePatch,
				createdAt: now,
				linkApplicationId: core.identity.linkApplicationId,
			}));

		if (workspace) {
			await ctx.db.patch(workspace._id, workspacePatch);
		}

		const syncAttemptId = await ctx.db.insert("velocitySyncAttempts", {
			completedAt: now,
			connectorCredentialContext: args.fetchCredentialContext,
			dealHref: args.dealHref,
			idempotencyKey: syncIdempotencyKey,
			loanCode: core.identity.loanCode,
			normalizedCoreHash: core.normalizedHash,
			rawDealHash: core.rawDealHash,
			rawResponseBody: args.rawResponseBody,
			request: args.request,
			responseStatus: args.responseStatus,
			result: "succeeded",
			startedAt: args.startedAt,
			trigger: args.trigger,
			workspaceId,
		});

		const snapshotId =
			workspace?.normalizedCoreHash === core.normalizedHash
				? undefined
				: await ctx.db.insert("velocityPackageSnapshots", {
						createdAt: now,
						createdBy:
							args.trigger === "manual_sync_now"
								? "manual_sync_now"
								: "webhook",
						linkApplicationId: core.identity.linkApplicationId,
						loanCode: core.identity.loanCode,
						normalizedCore: core,
						normalizedCoreHash: core.normalizedHash,
						rawDealHash: core.rawDealHash,
						rawDealJson: stableVelocityJsonStringify(args.rawDeal),
						snapshotType: "upstream_core",
						workspaceId,
					});

		await ctx.db.patch(workspaceId, {
			lastSyncAttemptId: syncAttemptId,
			lastWebhookEventId: args.webhookEventId,
		});

		const activeExceptionFingerprints = new Set(
			readiness.blockers
				.map((readinessBlocker) => {
					const currentException = exceptionForBlocker(readinessBlocker);
					return currentException
						? exceptionFingerprint(currentException.kind, readinessBlocker)
						: null;
				})
				.filter((fingerprint): fingerprint is string => fingerprint !== null)
		);

		for (const readinessBlocker of readiness.blockers) {
			await openOrUpdateException(ctx, {
				blocker: readinessBlocker,
				details: {
					fetchCredentialContext: args.fetchCredentialContext,
					linkApplicationId: core.identity.linkApplicationId,
					loanCode: core.identity.loanCode,
					normalizedCoreHash: core.normalizedHash,
					rawDealHash: core.rawDealHash,
					webhookAgent: args.webhookAgent,
					webhookCredentialContext: args.webhookCredentialContext,
				},
				sourceSyncAttemptId: syncAttemptId,
				sourceWebhookEventId: args.webhookEventId,
				workspaceId,
			});
		}
		await supersedeStaleFingerprintExceptions(ctx, {
			activeFingerprints: activeExceptionFingerprints,
			now,
			sourceSyncAttemptId: syncAttemptId,
			workspaceId,
		});

		await appendSyncAuditEntries(ctx, {
			connectorCredentialContext: args.fetchCredentialContext,
			core,
			previousState: workspace?.state,
			readiness,
			snapshotId,
			syncAttemptId,
			webhookAgent: args.webhookAgent,
			webhookCredentialContext: args.webhookCredentialContext,
			webhookEventId: args.webhookEventId,
			workspaceId,
		});

		await patchWebhookEvent(ctx, {
			status: "processed",
			webhookEventId: args.webhookEventId,
			workspaceId,
		});

		return { result: "succeeded", syncAttemptId, workspaceId };
	})
	.internal();

export const syncVelocityPackageNow = adminAction
	.input({
		workspaceId: v.id("velocityPackageWorkspaces"),
	})
	.handler(async (ctx, args): Promise<VelocityFullDealSyncResult> => {
		const locator = await ctx.runQuery(
			getVelocityWorkspaceSyncLocatorReference,
			{
				workspaceId: args.workspaceId,
			}
		);

		return await ctx.runAction(processVelocityFullDealSyncReference, {
			expectedLinkApplicationId: locator.linkApplicationId,
			expectedWorkspaceId: locator.workspaceId,
			loanCode: locator.loanCode,
			trigger: "manual_sync_now",
		});
	})
	.public();
