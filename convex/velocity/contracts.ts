import type { Id } from "../_generated/dataModel";
import type {
	FairLendPaymentFrequency,
	FairLendRateType,
	VELOCITY_CORE_SOURCE_VERSION,
	VELOCITY_CREATION_SOURCE,
	VELOCITY_ORIGINATION_PATH,
	VELOCITY_PROVIDER,
	VELOCITY_WORKFLOW_SOURCE_TYPE,
	VelocityActivationAttemptStatus,
	VelocityDateTypeCode,
	VelocityDealStatusCode,
	VelocityMortgageRequestPurposeCode,
	VelocityPackageDocumentRole,
	VelocityPackageExceptionKind,
	VelocityPackageExceptionSeverity,
	VelocityPackageExceptionStatus,
	VelocityPackageWorkspaceState,
	VelocityPropertyIntendedUseCode,
	VelocityPropertyMortgagePaymentFrequencyCode,
	VelocityPropertyMortgageRateTypeCode,
	VelocityReadinessBlockerCode,
	VelocitySnapshotCreator,
	VelocitySnapshotType,
	VelocityStatusSemantics,
	VelocityStreetDirectionCode,
	VelocitySyncResult,
	VelocitySyncTrigger,
	VelocityWebhookEventStatus,
} from "./constants";

export type VelocityJsonObject = Record<string, unknown>;

export interface VelocityWebhookAgent {
	email?: string | null;
	firmCode?: string | null;
	firstName?: string | null;
	lastName?: string | null;
	tenantId?: string | null;
	username?: string | null;
}

export interface VelocityConnectorCredentialContext {
	apiKeyFingerprint?: string;
	credentialId?: string;
	email?: string | null;
	firmCode?: string | null;
	provider: typeof VELOCITY_PROVIDER;
	scope?: string;
	tenantId?: string | null;
	usedFor: "full_deal_fetch" | "search_deals" | "webhook_ingress";
	username?: string | null;
}

export interface VelocityWebhookPayload {
	agent?: VelocityWebhookAgent | null;
	events?: Array<{
		deal?: {
			loanCode?: string | null;
			status?: VelocityDealStatusCode | number | null;
		} | null;
		eventType?: number | null;
		links?: Array<{
			href?: string | null;
			method?: string | null;
			rel?: string | null;
		}> | null;
		timestamp?: string | null;
	}> | null;
	timestamp: string;
}

export interface VelocityDealsPage {
	deals?: VelocityDeal[] | null;
	pageNumber: number;
	totalDeals: number;
	totalPages: number;
}

export interface VelocitySearchDealsRequest {
	customSources?: string[] | null;
	dateType?: VelocityDateTypeCode | null;
	endDate?: string | null;
	loanCodes?: string[] | null;
	page?: number | null;
	startDate?: string | null;
	statuses?: VelocityDealStatusCode[] | null;
}

export interface VelocityDeal {
	agent?: string | null;
	borrowers?: VelocityBorrower[] | null;
	closingDate?: string | null;
	conditions?: VelocityCondition[] | null;
	customSource?: string | null;
	dateCreated?: string | null;
	isConfirmedCompliant?: boolean | null;
	lenderConditions?: string[] | null;
	lenderReferenceNumber?: string | null;
	linkApplicationId?: string | null;
	loanCode?: string | null;
	mortgageRequest?: VelocityMortgageRequest | null;
	notes?: VelocityNote[] | null;
	referral?: VelocityReferral | null;
	solicitor?: VelocitySolicitor | null;
	status?: VelocityDealStatusCode | number | null;
	subjectProperty?: VelocitySubjectProperty | null;
	[unknownVelocityField: string]: unknown;
}

export interface VelocityBorrower {
	addresses?: VelocityAddress[] | null;
	assets?: Array<{
		description?: string | null;
		downPayment?: number | null;
		type?: string | null;
		value?: number | null;
	}> | null;
	businessPhone?: string | null;
	cellPhone?: string | null;
	creditScore?: number | null;
	dateOfBirth?: string | null;
	email?: string | null;
	employmentHistory?: {
		employerName?: string | null;
		employmentAddress?: VelocityAddress | null;
		grossRevenue?: number | null;
		incomePeriod?: number | null;
		incomeType?: number | null;
		isCurrent?: boolean | null;
	} | null;
	firstName?: string | null;
	firstTimeHomeBuyer?: boolean | null;
	homePhone?: string | null;
	lastName?: string | null;
	liabilities?: Array<{
		balance?: number | null;
		closingDate?: string | null;
		description?: string | null;
		inCreditBureau?: boolean | null;
		lender?: string | null;
		limit?: number | null;
		override?: boolean | null;
		payment?: number | null;
		payoffTypeId?: number | null;
		typeId?: number | null;
	}> | null;
	mailingAddress?: VelocityAddress | null;
	properties?: VelocityBorrowerProperty[] | null;
}

export interface VelocityAddress {
	city?: string | null;
	country?: number | null;
	postalCode?: string | null;
	provinceOrState?: number | null;
	streetDirection?: VelocityStreetDirectionCode | number | null;
	streetName?: string | null;
	streetNumber?: string | null;
	streetType?: number | null;
	unitNumber?: string | null;
}

export interface VelocityBorrowerProperty {
	address?: VelocityAddress | null;
	futureStatus?: number | null;
	mortgages?: Array<{ amount?: number | null }> | null;
	occupancy?: number | null;
	propertyValue?: number | null;
}

export interface VelocitySubjectProperty {
	city?: string | null;
	constructionType?: string | null;
	intendedUse?: VelocityPropertyIntendedUseCode | number | null;
	postalCode?: string | null;
	propertyType?: string | null;
	province?: number | null;
	purchasePrice?: number | null;
	streetDirection?: VelocityStreetDirectionCode | number | null;
	streetName?: string | null;
	streetNumber?: string | null;
	streetType?: number | null;
	tenure?: string | null;
	unitNumber?: string | null;
}

export interface VelocityMortgageRequest {
	amortization?: number | null;
	amortizationMonths?: number | null;
	buyDownRate?: number | null;
	discountRate?: number | null;
	firstPaymentDate?: string | null;
	interestAdjustmentDate?: string | null;
	lenderName?: string | null;
	maturityDate?: string | null;
	mortgages?: Array<{ amount?: number | null }> | null;
	netRate?: number | null;
	payment?: number | null;
	paymentFrequency?:
		| VelocityPropertyMortgagePaymentFrequencyCode
		| number
		| null;
	premiumRate?: number | null;
	purpose?: VelocityMortgageRequestPurposeCode | number | null;
	rate?: number | null;
	rateType?: VelocityPropertyMortgageRateTypeCode | number | null;
	termInMonths?: number | null;
}

export interface VelocityCondition {
	isApproved?: boolean | null;
	isSent?: boolean | null;
	name?: string | null;
}

export interface VelocityNote {
	dateCreated?: string | null;
	text?: string | null;
}

export type VelocityReferral = VelocityJsonObject;
export type VelocitySolicitor = VelocityJsonObject;

export interface VelocityNormalizedCoreV1 {
	borrowers: Array<{
		businessPhone?: string | null;
		cellPhone?: string | null;
		creditScore?: number | null;
		dateOfBirth?: string | null;
		email?: string | null;
		firstName?: string | null;
		fullName: string;
		homePhone?: string | null;
		lastName?: string | null;
		mailingAddress?: VelocityAddress | null;
		primaryAddress?: VelocityAddress | null;
	}>;
	conditions: Array<{
		isApproved?: boolean;
		isSent?: boolean;
		name: string;
	}>;
	identity: {
		customSource?: string | null;
		lenderReferenceNumber?: string | null;
		linkApplicationId: string;
		loanCode: string;
	};
	lenderConditions: string[];
	mortgageRequest: {
		amortization?: number | null;
		amortizationMonths?: number | null;
		buyDownRate?: number | null;
		discountRate?: number | null;
		fairlendPaymentFrequency?: FairLendPaymentFrequency | null;
		fairlendRateType?: FairLendRateType | null;
		firstPaymentDate?: string | null;
		interestAdjustmentDate?: string | null;
		lenderName?: string | null;
		maturityDate?: string | null;
		netRate?: number | null;
		paymentAmount?: number | null;
		paymentFrequencyCode?: number | null;
		paymentFrequencyLabel?: string | null;
		premiumRate?: number | null;
		purposeCode?: number | null;
		purposeLabel?: string | null;
		rate?: number | null;
		rateTypeCode?: number | null;
		rateTypeLabel?: string | null;
		requestedPrincipal?: number | null;
		termInMonths?: number | null;
	};
	normalizedHash: string;
	notes: Array<{
		dateCreated?: string | null;
		text: string;
	}>;
	rawDealHash: string;
	referral?: VelocityReferral | null;
	solicitor?: VelocitySolicitor | null;
	sourceVersion: typeof VELOCITY_CORE_SOURCE_VERSION;
	subjectProperty: {
		city?: string | null;
		constructionType?: string | null;
		intendedUseCode?: number | null;
		intendedUseLabel?: string | null;
		postalCode?: string | null;
		propertyTypeRaw?: string | null;
		province?: string | null;
		provinceCode?: number | null;
		purchasePrice?: number | null;
		streetDirectionCode?: number | null;
		streetName?: string | null;
		streetNumber?: string | null;
		streetTypeCode?: number | null;
		tenure?: string | null;
		unit?: string | null;
	};
	upstream: {
		agent?: string | null;
		closingDate?: string | null;
		dateCreated?: string | null;
		isConfirmedCompliant?: boolean | null;
		statusCode: VelocityDealStatusCode | number | null;
		statusLabel: string | null;
	};
}

export type VelocityLoanType = "conventional" | "high_ratio" | "insured";
export type VelocityMortgagePropertyType =
	| "commercial"
	| "condo"
	| "multi_unit"
	| "residential";

export interface VelocityActivationRemediationV1 {
	assignedBrokerId?: Id<"brokers">;
	borrowerRoleOverrides?: Array<{
		borrowerExternalKey: string;
		role: "co_borrower" | "guarantor" | "primary";
	}>;
	brokerOfRecordId?: Id<"brokers">;
	lienPosition?: number;
	loanType?: VelocityLoanType;
	notes?: string;
	policyInputs?: Record<string, unknown>;
}

export interface VelocityFairLendEnrichmentV1 {
	activationRemediation?: VelocityActivationRemediationV1;
	bankInput?: {
		accountHolderName?: string;
		accountLast4?: string;
		accountNumber?: string;
		country: "CA";
		currency: "CAD";
		institutionNumber?: string;
		transitNumber?: string;
	};
	listingOverrides?: {
		adminNotes?: string;
		description?: string;
		displayOrder?: number;
		featured?: boolean;
		heroImages?: Array<{ caption?: string; storageId: Id<"_storage"> }>;
		marketplaceCopy?: string;
		seoSlug?: string;
		title?: string;
	};
	padEvidence?: {
		documentAssetId: Id<"documentAssets">;
		fileHash: string;
		mimeType: "application/pdf";
		originalFilename: string;
		uploadedAt: number;
		uploadedByUserId: Id<"users">;
	};
	staffNotes?: string;
	valuation?: {
		comparables?: Record<string, unknown>[];
		relatedDocumentAssetId?: Id<"documentAssets">;
		valuationDate?: string;
		valueAsIs?: number;
	};
}

export interface VelocityReadinessBlockerV1 {
	code: VelocityReadinessBlockerCode;
	fieldPath?: string;
	message: string;
	severity: "blocking" | "warning";
	source: "fairlend" | "system" | "velocity";
}

export interface VelocityReadinessWarningV1 {
	code: string;
	fieldPath?: string;
	message: string;
}

export interface VelocityReadinessV1 {
	blockers: VelocityReadinessBlockerV1[];
	canActivate: boolean;
	canFinalReview: boolean;
	warnings: VelocityReadinessWarningV1[];
}

export interface VelocityFinalReviewV1 {
	reviewedAt: number;
	reviewedByUserId: Id<"users">;
	reviewedSnapshotHash: string;
	reviewedSnapshotId: Id<"velocityPackageSnapshots">;
}

export interface VelocityWorkspaceActivationSummaryV1 {
	activatedAt?: number;
	activatedByUserId?: Id<"users">;
	activationAttemptId?: Id<"velocityActivationAttempts">;
	listingId?: Id<"listings">;
	mortgageId?: Id<"mortgages">;
}

export interface VelocityActivationHandoffV1 {
	activationAttemptId: Id<"velocityActivationAttempts">;
	actorAuthId: string;
	actorType: "admin" | "member";
	assignedBrokerId?: Id<"brokers">;
	borrowerLinks: Array<{
		borrowerId: Id<"borrowers">;
		role: "co_borrower" | "guarantor" | "primary";
	}>;
	brokerOfRecordId: Id<"brokers">;
	collectionsDraft: {
		activationStatus: "active" | "activating" | "failed" | "pending";
		mode: "provider_managed_now";
		padAuthorizationAssetId: Id<"documentAssets">;
		padAuthorizationSource: "uploaded";
		providerCode: "pad_rotessa";
		selectedBankAccountId?: Id<"bankAccounts">;
	};
	listingOverrides?: VelocityFairLendEnrichmentV1["listingOverrides"];
	mortgageDraft: {
		amortizationMonths: number;
		annualServicingRate?: number;
		firstPaymentDate: string;
		fundedAt?: number;
		interestAdjustmentDate: string;
		interestRate: number;
		isRenewal?: boolean;
		lienPosition: number;
		loanType: VelocityLoanType;
		maturityDate: string;
		paymentAmount: number;
		paymentFrequency: FairLendPaymentFrequency;
		principal: number;
		priorMortgageId?: Id<"mortgages">;
		rateType: FairLendRateType;
		termMonths: number;
		termStartDate: string;
	};
	orgId?: string;
	propertyDraft: {
		create?: {
			approximateLatitude?: number;
			approximateLongitude?: number;
			city: string;
			googlePlaceData?: unknown;
			postalCode: string;
			propertyType: VelocityMortgagePropertyType;
			province: string;
			streetAddress: string;
			unit?: string;
		};
		propertyId?: Id<"properties">;
	};
	reviewedSnapshotHash: string;
	reviewedSnapshotId: Id<"velocityPackageSnapshots">;
	source: {
		creationSource: typeof VELOCITY_CREATION_SOURCE;
		originatedByUserId: string;
		originatingWorkflowId: string;
		originatingWorkflowType: typeof VELOCITY_WORKFLOW_SOURCE_TYPE;
		originationPath: typeof VELOCITY_ORIGINATION_PATH;
		workflowSourceId: string;
		workflowSourceKey: `velocity_package:mortgage:${string}`;
		workflowSourceType: typeof VELOCITY_WORKFLOW_SOURCE_TYPE;
	};
	valuationDraft?: VelocityFairLendEnrichmentV1["valuation"];
	viewerUserId: Id<"users">;
}

export interface VelocityPackageWorkspaceRecordV1 {
	activation?: VelocityWorkspaceActivationSummaryV1;
	createdAt: number;
	currentVelocityStatusCode?: number;
	currentVelocityStatusLabel?: string;
	exceptionKind?: VelocityPackageExceptionKind;
	exceptionSummary?: string;
	fairlendEnrichment: VelocityFairLendEnrichmentV1;
	finalReview?: VelocityFinalReviewV1;
	lastSyncAttemptId?: Id<"velocitySyncAttempts">;
	lastWebhookEventId?: Id<"velocityWebhookEvents">;
	lenderReferenceNumber?: string;
	linkApplicationId: string;
	loanCode: string;
	normalizedCore: VelocityNormalizedCoreV1;
	normalizedCoreHash: string;
	orgId?: string;
	readiness: VelocityReadinessV1;
	state: VelocityPackageWorkspaceState;
	updatedAt: number;
}

export interface VelocityPackageSnapshotRecordV1 {
	createdAt: number;
	createdBy: VelocitySnapshotCreator;
	createdByUserId?: Id<"users">;
	linkApplicationId: string;
	loanCode: string;
	normalizedCore: VelocityNormalizedCoreV1;
	normalizedCoreHash: string;
	rawDealHash: string;
	rawDealJson: string;
	snapshotType: VelocitySnapshotType;
	workspaceId: Id<"velocityPackageWorkspaces">;
}

export interface VelocityWebhookEventRecordV1 {
	attempts: number;
	connectorCredentialContext?: VelocityConnectorCredentialContext;
	dealHref?: string;
	error?: string;
	eventType?: number;
	loanCode?: string;
	processedAt?: number;
	provider: typeof VELOCITY_PROVIDER;
	providerEventId: string;
	rawBody: string;
	receivedAt: number;
	signatureVerified: boolean;
	status: VelocityWebhookEventStatus;
	statusCode?: number;
	webhookAgent?: VelocityWebhookAgent;
	workspaceId?: Id<"velocityPackageWorkspaces">;
}

export interface VelocitySyncAttemptRecordV1 {
	completedAt?: number;
	connectorCredentialContext?: VelocityConnectorCredentialContext;
	dealHref?: string;
	error?: string;
	idempotencyKey?: string;
	loanCode?: string;
	normalizedCoreHash?: string;
	rawDealHash?: string;
	rawResponseBody?: string;
	request: Record<string, unknown>;
	responseStatus?: number;
	result: VelocitySyncResult;
	startedAt: number;
	trigger: VelocitySyncTrigger;
	workspaceId?: Id<"velocityPackageWorkspaces">;
}

export interface VelocityActivationAttemptRecordV1 {
	actorAuthId: string;
	actorUserId: Id<"users">;
	bankAccountId?: Id<"bankAccounts">;
	completedAt?: number;
	externalCollectionScheduleId?: Id<"externalCollectionSchedules">;
	externalCustomerProfileId?: Id<"externalCustomerProfiles">;
	failedAt?: number;
	failureCode?: string;
	failureMessage?: string;
	idempotencyKey: string;
	listingId?: Id<"listings">;
	mortgageId?: Id<"mortgages">;
	reviewedSnapshotHash: string;
	reviewedSnapshotId: Id<"velocityPackageSnapshots">;
	rotessaCustomerRef?: string;
	rotessaScheduleRef?: string;
	startedAt: number;
	status: VelocityActivationAttemptStatus;
	workspaceId: Id<"velocityPackageWorkspaces">;
}

export interface VelocityPackageExceptionRecordV1 {
	details?: Record<string, unknown>;
	kind: VelocityPackageExceptionKind;
	message: string;
	openedAt: number;
	resolvedAt?: number;
	resolvedByUserId?: Id<"users">;
	severity: VelocityPackageExceptionSeverity;
	sourceActivationAttemptId?: Id<"velocityActivationAttempts">;
	sourceSyncAttemptId?: Id<"velocitySyncAttempts">;
	sourceWebhookEventId?: Id<"velocityWebhookEvents">;
	status: VelocityPackageExceptionStatus;
	title: string;
	workspaceId?: Id<"velocityPackageWorkspaces">;
}

export interface VelocityPackageDocumentLinkRecordV1 {
	documentAssetId: Id<"documentAssets">;
	linkedAt: number;
	linkedByUserId: Id<"users">;
	role: VelocityPackageDocumentRole;
	supersededAt?: number;
	workspaceId: Id<"velocityPackageWorkspaces">;
}

export const VELOCITY_PACKAGE_AUDIT_EVENT_TYPES = [
	"velocity_webhook_received",
	"velocity_webhook_provenance_recorded",
	"velocity_full_deal_fetch_attempted",
	"velocity_full_deal_fetch_failed",
	"velocity_normalized",
	"velocity_identity_validated",
	"velocity_identity_exception_opened",
	"velocity_fairlend_enrichment_updated",
	"velocity_document_linked",
	"velocity_readiness_recomputed",
	"velocity_final_review_confirmed",
	"velocity_exception_resolved",
	"velocity_activation_attempt_started",
	"velocity_activation_provider_artifact_recorded",
	"velocity_activation_provider_artifact_reused",
	"velocity_activation_stage_changed",
	"velocity_activation_failed",
	"velocity_activation_succeeded",
	"velocity_activation_provider_artifact_recorded",
	"velocity_activation_provider_artifact_reused",
	"velocity_post_live_drift_detected",
] as const;

export type VelocityPackageAuditEventType =
	(typeof VELOCITY_PACKAGE_AUDIT_EVENT_TYPES)[number];

export interface VelocityPackageAuditPayload {
	activationAttemptId?: string;
	connectorCredentialContext?: VelocityConnectorCredentialContext;
	exceptionKind?: VelocityPackageExceptionKind;
	linkApplicationId?: string;
	loanCode?: string;
	normalizedCoreHash?: string;
	rawDealHash?: string;
	readiness?: VelocityReadinessV1;
	reviewedSnapshotHash?: string;
	snapshotId?: string;
	statusSemantics?: VelocityStatusSemantics;
	webhookAgent?: VelocityWebhookAgent;
	workspaceId?: string;
	[key: string]: unknown;
}
