import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import { assertDealAccess } from "../authz/resourceAccess";
import {
	buildDealParticipantProjection,
	type DealParticipantProjection,
} from "../deals/participantProjection";
import {
	adminAction,
	adminMutation,
	convex,
	dealQuery,
	documentQuery,
	requirePermission,
	requirePermissionAction,
} from "../fluent";
import {
	type DealDocumentPackageStatus,
	type DealDocumentSourceBlueprintSnapshot,
	type DealDocumentStoredRemediationAction,
	type DealPackageBlueprintSnapshot,
	dealDocumentInstanceKindValidator,
	dealDocumentInstanceStatusValidator,
	dealDocumentPackageStatusValidator,
	dealDocumentSourceBlueprintSnapshotValidator,
	dealDocumentStoredRemediationActionValidator,
	dealPackageBlueprintSnapshotValidator,
	dealSigningExceptionKindValidator,
	dealSigningExceptionSeverityValidator,
	generatedDocumentSigningStatusValidator,
	signatureEnvelopeStatusValidator,
	signatureProviderCodeValidator,
	signatureProviderRoleValidator,
	signatureRecipientStatusValidator,
} from "./contracts";
import {
	buildDealDocumentRemediation,
	getDealDocumentRemediationEligibility,
} from "./dealPackageRemediationModel";
import { listMortgageBlueprintRows } from "./mortgageBlueprints";
import { canStartSigningForDealStatus } from "./signature/gates";
import {
	getSignatureProvider,
	mapEnvelopeStatusToDealDocumentInstanceStatus,
	mapEnvelopeStatusToGeneratedDocumentSigningStatus,
	type SignatureProviderCreateEnvelopeResult,
	type SignatureProviderRecipientInput,
	type SignatureProviderSyncEnvelopeResult,
} from "./signature/provider";

type InstanceRow = Doc<"dealDocumentInstances">;
type BlueprintRow = Doc<"mortgageDocumentBlueprints">;
type EnvelopeRow = Doc<"signatureEnvelopes">;
type RecipientRow = Doc<"signatureRecipients">;
type GeneratedDocumentRow = Doc<"generatedDocuments">;

interface DealPackageViewerContext {
	isFairLendAdmin: boolean;
	userId?: Id<"users">;
}

interface SignatoryParticipant {
	email: string;
	name: string;
	platformRole: string;
	userId?: Id<"users">;
}

interface SignatoryMapping {
	email: string;
	name: string;
	platformRole: string;
}

interface PackageInstanceSigningRecipientSurface {
	declinedAt: number | null;
	email: string;
	isCurrentViewer: boolean;
	name: string;
	openedAt: number | null;
	platformRole: string;
	providerRecipientId: string | null;
	providerRole: RecipientRow["providerRole"];
	signedAt: number | null;
	signingOrder: number;
	status: RecipientRow["status"];
	userId: Id<"users"> | null;
}

interface PackageInstanceSigningSurface {
	canLaunchEmbeddedSigning: boolean;
	envelopeId: Id<"signatureEnvelopes"> | null;
	generatedDocumentSigningStatus: GeneratedDocumentRow["signingStatus"] | null;
	lastError: string | null;
	lastProviderSyncAt: number | null;
	providerCode: EnvelopeRow["providerCode"] | null;
	providerEnvelopeId: string | null;
	recipients: PackageInstanceSigningRecipientSurface[];
	status: EnvelopeRow["status"] | null;
}

interface PackageInstanceArchivedSigningSurface {
	completionCertificateUrl: string | null;
	finalPdfUrl: string | null;
	signingCompletedAt: number | null;
}

interface ParticipantSnapshot {
	assignedBroker?: {
		brokerId: Id<"brokers">;
		email: string;
		fullName: string;
		userId: Id<"users">;
	};
	borrowers: Array<{
		borrowerId: Id<"borrowers">;
		email: string;
		fullName: string;
		role: Doc<"mortgageBorrowers">["role"];
		userId: Id<"users">;
	}>;
	brokerOfRecord: {
		brokerId: Id<"brokers">;
		email: string;
		fullName: string;
		userId: Id<"users">;
	};
	dealParticipants: DealParticipantProjection;
	dealStatus: string;
	latestValuationSnapshot: Doc<"mortgageValuationSnapshots"> | null;
	listing?: Doc<"listings"> | null;
	mortgage: Doc<"mortgages">;
	property: Doc<"properties">;
}

interface PackageSurface {
	instances: Array<{
		archivedSigning: PackageInstanceArchivedSigningSurface | null;
		archivedAt: number | null;
		assetId: Id<"documentAssets"> | null;
		category: string | null;
		class: Doc<"dealDocumentInstances">["sourceBlueprintSnapshot"]["class"];
		createdAt: number;
		dealId: Id<"deals">;
		displayName: string;
		generatedDocumentId: Id<"generatedDocuments"> | null;
		instanceId: Id<"dealDocumentInstances">;
		kind: Doc<"dealDocumentInstances">["kind"];
		lastError: string | null;
		mortgageId: Id<"mortgages">;
		packageId: Id<"dealDocumentPackages">;
		packageKey: string | null;
		packageLabel: string | null;
		remediation: ReturnType<typeof buildDealDocumentRemediation>;
		remediationAction: DealDocumentStoredRemediationAction | null;
		remediationReason: string | null;
		sourceBlueprintId: Id<"mortgageDocumentBlueprints"> | null;
		signingState: PackageSigningState | null;
		status: Doc<"dealDocumentInstances">["status"];
		supersededByInstanceId: Id<"dealDocumentInstances"> | null;
		signing: PackageInstanceSigningSurface | null;
		templateId: Id<"documentTemplates"> | null;
		templateVersion: number | null;
		url: string | null;
	}>;
	package: {
		archivedAt: number | null;
		createdAt: number;
		dealId: Id<"deals">;
		lastError: string | null;
		mortgageId: Id<"mortgages">;
		packageId: Id<"dealDocumentPackages">;
		readyAt: number | null;
		retryCount: number;
		status: Doc<"dealDocumentPackages">["status"];
		updatedAt: number;
	} | null;
	participants: DealParticipantProjection | null;
}

interface PackageSigningState {
	activeAttemptId: Id<"dealEnvelopeAttempts"> | null;
	attemptNumber: number | null;
	completedRequiredCount: number;
	exceptionCount: number;
	providerDocumentId: string | null;
	providerEnvelopeId: string | null;
	recipientCount: number;
	requiredCount: number;
	status: Doc<"dealEnvelopeAttempts">["status"] | null;
}

interface CreateDocumentPackageResult {
	dealId: Id<"deals">;
	packageId: Id<"dealDocumentPackages">;
	status: DealDocumentPackageStatus;
}

interface DealDocumentInstanceRemediationTarget {
	deal: Doc<"deals">;
	instance: InstanceRow;
	mortgage: Doc<"mortgages">;
	packageRecord: Doc<"dealDocumentPackages">;
}

interface DealDocumentInstanceRemediationResult {
	ok: true;
	replacementInstanceId: Id<"dealDocumentInstances"> | null;
}

interface DealPackageActionCtx
	extends Pick<
		ActionCtx,
		"runAction" | "runMutation" | "runQuery" | "storage"
	> {}

interface DealPackageActionArgs {
	dealId: Id<"deals">;
	retry: boolean;
}

interface DealPackageRuntimeState {
	dealId: Id<"deals">;
	dealStatus: string;
	mortgageId: Id<"mortgages">;
	packageId: Id<"dealDocumentPackages">;
	signatories: Array<{
		email: string;
		name: string;
		platformRole: string;
	}>;
	signatoryParticipants: SignatoryParticipant[];
	variables: Record<string, string>;
}

interface SignableArchiveTarget {
	completionCertificateStorageId: Id<"_storage"> | null;
	envelopeId: Id<"signatureEnvelopes">;
	envelopeStatus: EnvelopeRow["status"];
	finalPdfStorageId: Id<"_storage"> | null;
	generatedDocumentId: Id<"generatedDocuments">;
	instanceArchivedAt: number | null;
	instanceId: Id<"dealDocumentInstances">;
	providerCode: EnvelopeRow["providerCode"];
	providerEnvelopeId: string;
	signingCompletedAt: number | null;
}

interface SignableArchiveState {
	package: {
		archivedAt: number | null;
		packageId: Id<"dealDocumentPackages">;
		status: Doc<"dealDocumentPackages">["status"];
	};
	targets: SignableArchiveTarget[];
}

interface ArchiveCompletedSignableDocumentsResult {
	archivedCount: number;
	packageArchived: boolean;
	packageId: Id<"dealDocumentPackages"> | null;
	skippedCount: number;
	targetCount: number;
}

const SIGNATORY_MAPPING_ERROR_RE = /signatory mapping validation failed/i;
const EMPTY_SIGNABLE_RECIPIENTS_ERROR =
	"Signable template configuration error: no Documenso recipients were generated for this blueprint.";
const DOCUMENSO_PROVIDER_PREFLIGHT_OR_CREATE_FAILED_MESSAGE =
	"Documenso provider preflight or create failed.";
const PROVIDER_ERROR_DETAIL_MAX_LENGTH = 2000;

type DealPackagePreparation =
	| {
			result: CreateDocumentPackageResult;
	  }
	| {
			packageId: Id<"dealDocumentPackages">;
			runtime: DealPackageRuntimeState;
			workItems: PackageWorkItem[];
	  };

type PackageWorkItem =
	| {
			type: "snapshot";
			snapshot: DealPackageBlueprintSnapshot;
	  }
	| {
			type: "instance_retry";
			instance: InstanceRow;
	  };

function toFullName(user: { firstName?: string; lastName?: string }): string {
	const fullName = [user.firstName, user.lastName]
		.filter(Boolean)
		.join(" ")
		.trim();
	return fullName.length > 0 ? fullName : "Unavailable";
}

function normalizeText(value: string | null | undefined) {
	const trimmed = value?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : "";
}

function truncateProviderDiagnostic(value: string) {
	return value.length > PROVIDER_ERROR_DETAIL_MAX_LENGTH
		? `${value.slice(0, PROVIDER_ERROR_DETAIL_MAX_LENGTH - 3)}...`
		: value;
}

function stringifyUnknownError(error: unknown) {
	if (error && typeof error === "object" && "data" in error) {
		try {
			return JSON.stringify((error as { data: unknown }).data);
		} catch {
			return String((error as { data: unknown }).data);
		}
	}

	return error instanceof Error ? error.message : String(error);
}

function providerFailureLastError(error: unknown) {
	return truncateProviderDiagnostic(
		`${DOCUMENSO_PROVIDER_PREFLIGHT_OR_CREATE_FAILED_MESSAGE} ${stringifyUnknownError(
			error
		)}`
	);
}

export function toDealPackageBlueprintSnapshot(
	blueprint: Pick<
		BlueprintRow,
		| "_id"
		| "assetId"
		| "category"
		| "class"
		| "description"
		| "displayName"
		| "displayOrder"
		| "mappingOverrides"
		| "packageKey"
		| "packageLabel"
		| "templateId"
		| "templateVersion"
	>
): DealPackageBlueprintSnapshot {
	return {
		assetId: blueprint.assetId,
		sourceBlueprintId: blueprint._id,
		sourceBlueprintSnapshot: {
			category: blueprint.category,
			class: blueprint.class,
			description: blueprint.description,
			displayName: blueprint.displayName,
			displayOrder: blueprint.displayOrder,
			mappingOverrides: blueprint.mappingOverrides,
			packageKey: blueprint.packageKey,
			packageLabel: blueprint.packageLabel,
			templateId: blueprint.templateId,
			templateVersion: blueprint.templateVersion,
		},
	};
}

async function requireDealContext(
	ctx: Pick<QueryCtx, "db">,
	dealId: Id<"deals">
) {
	const deal = await ctx.db.get(dealId);
	if (!deal) {
		throw new ConvexError("Deal not found");
	}

	const mortgage = await ctx.db.get(deal.mortgageId);
	if (!mortgage) {
		throw new ConvexError("Deal mortgage not found");
	}

	const property = await ctx.db.get(mortgage.propertyId);
	if (!property) {
		throw new ConvexError("Deal property not found");
	}

	const listing = await ctx.db
		.query("listings")
		.withIndex("by_mortgage", (query) => query.eq("mortgageId", mortgage._id))
		.unique();

	return { deal, listing, mortgage, property };
}

async function requireBrokerParticipant(
	ctx: Pick<QueryCtx, "db">,
	brokerId: Id<"brokers">
) {
	const broker = await ctx.db.get(brokerId);
	if (!broker) {
		throw new ConvexError("Broker participant not found");
	}

	const user = await ctx.db.get(broker.userId);
	if (!user) {
		throw new ConvexError("Broker participant user not found");
	}

	return {
		brokerId: broker._id,
		email: normalizeText(user.email),
		fullName: toFullName(user),
		userId: user._id,
	};
}

async function getUserByAuthId(ctx: Pick<QueryCtx, "db">, authId: string) {
	return ctx.db
		.query("users")
		.withIndex("authId", (query) => query.eq("authId", authId))
		.unique();
}

async function resolveLatestValuationSnapshot(
	ctx: Pick<QueryCtx, "db">,
	mortgageId: Id<"mortgages">
) {
	return ctx.db
		.query("mortgageValuationSnapshots")
		.withIndex("by_mortgage_created_at", (query) =>
			query.eq("mortgageId", mortgageId)
		)
		.order("desc")
		.first();
}

async function buildParticipantSnapshot(
	ctx: Pick<QueryCtx, "db">,
	dealId: Id<"deals">
): Promise<ParticipantSnapshot> {
	const { deal, listing, mortgage, property } = await requireDealContext(
		ctx,
		dealId
	);
	const [
		dealParticipants,
		brokerOfRecord,
		assignedBroker,
		borrowerLinks,
		latestValuationSnapshot,
	] = await Promise.all([
		buildDealParticipantProjection(ctx, deal),
		requireBrokerParticipant(ctx, mortgage.brokerOfRecordId),
		mortgage.assignedBrokerId
			? requireBrokerParticipant(ctx, mortgage.assignedBrokerId)
			: Promise.resolve(undefined),
		ctx.db
			.query("mortgageBorrowers")
			.withIndex("by_mortgage", (query) => query.eq("mortgageId", mortgage._id))
			.collect(),
		resolveLatestValuationSnapshot(ctx, mortgage._id),
	]);

	const borrowers = (
		await Promise.all(
			borrowerLinks.map(async (link) => {
				const borrower = await ctx.db.get(link.borrowerId);
				if (!borrower) {
					throw new ConvexError(
						"Mortgage borrower link points to missing borrower"
					);
				}

				const user = await ctx.db.get(borrower.userId);
				if (!user) {
					throw new ConvexError("Borrower user not found");
				}

				return {
					borrowerId: borrower._id,
					email: normalizeText(user.email),
					fullName: toFullName(user),
					role: link.role,
					userId: user._id,
				};
			})
		)
	).sort((left, right) => {
		const order = { primary: 0, co_borrower: 1, guarantor: 2 } as const;
		return order[left.role] - order[right.role];
	});

	return {
		assignedBroker,
		borrowers,
		brokerOfRecord,
		dealStatus: deal.status,
		dealParticipants,
		latestValuationSnapshot,
		listing,
		mortgage,
		property,
	};
}

interface PackageContact {
	email: string;
	fullName: string;
}

function projectionContact(participant: {
	displayName: string | null;
	email: string | null;
}): PackageContact | undefined {
	const email = normalizeText(participant.email);
	const fullName = normalizeText(participant.displayName);
	if (!(email && fullName)) {
		return undefined;
	}
	return { email, fullName };
}

const LEGACY_TEMPLATE_SIGNATORY_ROLE_ALIASES: Record<string, string> = {
	borrower: "primary_borrower",
	borrower_lawyer: "primary_lawyer",
	borrower_primary: "primary_borrower",
	borrower_co_1: "co_borrower_1",
	borrower_co_2: "co_borrower_2",
	fairlend_broker: "broker_of_record",
	lawyer_primary: "primary_lawyer",
	lender: "purchasing_lender",
	lender_lawyer: "primary_lawyer",
	lender_primary: "purchasing_lender",
	seller_lawyer: "primary_lawyer",
};

function hasResolvedSignatoryContact(entry: SignatoryMapping): boolean {
	return entry.email.trim().length > 0 && entry.name.trim().length > 0;
}

function appendLegacyTemplateRoleAliases<T extends SignatoryMapping>(
	participants: T[]
): T[] {
	const participantsByRole = new Map(
		participants.map((participant) => [participant.platformRole, participant])
	);
	const aliases: T[] = [];

	for (const [legacyRole, canonicalRole] of Object.entries(
		LEGACY_TEMPLATE_SIGNATORY_ROLE_ALIASES
	)) {
		if (participantsByRole.has(legacyRole)) {
			continue;
		}
		const participant = participantsByRole.get(canonicalRole);
		if (participant) {
			aliases.push({ ...participant, platformRole: legacyRole });
		}
	}

	return [...participants, ...aliases];
}

function buildDealVariableBag(snapshot: ParticipantSnapshot) {
	const purchasingLender = projectionContact(
		snapshot.dealParticipants.purchasing_lender
	);
	const sellingLender = projectionContact(
		snapshot.dealParticipants.selling_lender
	);
	const borrowerPrimary = projectionContact(
		snapshot.dealParticipants.primary_borrower
	);
	const lawyerPrimary = projectionContact(
		snapshot.dealParticipants.primary_lawyer
	);
	const coBorrowers = snapshot.borrowers.filter(
		(borrower) => borrower.role === "co_borrower"
	);
	const selectedFractionUnits = snapshot.dealParticipants.fractionalShareUnits;
	const investmentAmount = Math.round(
		(snapshot.mortgage.principal * selectedFractionUnits) / 10_000
	);

	const bag = {
		assigned_broker_email: snapshot.assignedBroker?.email ?? "",
		assigned_broker_full_name: snapshot.assignedBroker?.fullName ?? "",
		broker_of_record_email: snapshot.brokerOfRecord.email,
		broker_of_record_full_name: snapshot.brokerOfRecord.fullName,
		co_borrower_1_email: coBorrowers[0]?.email ?? "",
		co_borrower_1_full_name: coBorrowers[0]?.fullName ?? "",
		co_borrower_2_email: coBorrowers[1]?.email ?? "",
		co_borrower_2_full_name: coBorrowers[1]?.fullName ?? "",
		deal_investment_amount: String(investmentAmount),
		deal_selected_fraction_units: String(selectedFractionUnits),
		listing_description: snapshot.listing?.description ?? "",
		listing_marketplace_copy: snapshot.listing?.marketplaceCopy ?? "",
		listing_title: snapshot.listing?.title ?? "",
		mortgage_amortization_months: String(snapshot.mortgage.amortizationMonths),
		mortgage_amount: String(snapshot.mortgage.principal),
		mortgage_first_payment_date: snapshot.mortgage.firstPaymentDate,
		mortgage_interest_rate: String(snapshot.mortgage.interestRate),
		mortgage_lien_position: String(snapshot.mortgage.lienPosition),
		mortgage_maturity_date: snapshot.mortgage.maturityDate,
		mortgage_payment_amount: String(snapshot.mortgage.paymentAmount),
		mortgage_payment_frequency: snapshot.mortgage.paymentFrequency,
		mortgage_principal: String(snapshot.mortgage.principal),
		mortgage_rate_type: snapshot.mortgage.rateType,
		mortgage_term_months: String(snapshot.mortgage.termMonths),
		mortgage_term_start_date: snapshot.mortgage.termStartDate,
		property_city: snapshot.property.city,
		property_postal_code: snapshot.property.postalCode,
		property_province: snapshot.property.province,
		property_street_address: snapshot.property.streetAddress,
		property_type: snapshot.property.propertyType,
		property_unit: snapshot.property.unit ?? "",
		valuation_date:
			snapshot.latestValuationSnapshot?.valuationDate ??
			snapshot.mortgage.termStartDate,
		valuation_value_as_is: String(
			snapshot.latestValuationSnapshot?.valueAsIs ?? 0
		),
		primary_borrower_email: borrowerPrimary?.email ?? "",
		primary_borrower_full_name: borrowerPrimary?.fullName ?? "",
		primary_lawyer_email: lawyerPrimary?.email ?? "",
		primary_lawyer_full_name: lawyerPrimary?.fullName ?? "",
		purchasing_lender_email: purchasingLender?.email ?? "",
		purchasing_lender_full_name: purchasingLender?.fullName ?? "",
		purchasing_lender_system_id:
			snapshot.dealParticipants.purchasing_lender.userId ?? "",
		selling_lender_email: sellingLender?.email ?? "",
		selling_lender_full_name: sellingLender?.fullName ?? "",
		test_str_n72b_pv2: "Demo package value",
	};

	return {
		...bag,
		borrower_co_1_email: bag.co_borrower_1_email,
		borrower_co_1_full_name: bag.co_borrower_1_full_name,
		borrower_co_2_email: bag.co_borrower_2_email,
		borrower_co_2_full_name: bag.co_borrower_2_full_name,
		borrower_primary_email: bag.primary_borrower_email,
		borrower_primary_full_name: bag.primary_borrower_full_name,
		lawyer_primary_email: bag.primary_lawyer_email,
		lawyer_primary_full_name: bag.primary_lawyer_full_name,
		lender_primary_email: bag.purchasing_lender_email,
		lender_primary_full_name: bag.purchasing_lender_full_name,
		lender_primary_system_id: bag.purchasing_lender_system_id,
	};
}

function buildSignatoryMappings(snapshot: ParticipantSnapshot) {
	const purchasingLender = projectionContact(
		snapshot.dealParticipants.purchasing_lender
	);
	const sellingLender = projectionContact(
		snapshot.dealParticipants.selling_lender
	);
	const borrowerPrimary = projectionContact(
		snapshot.dealParticipants.primary_borrower
	);
	const lawyerPrimary = projectionContact(
		snapshot.dealParticipants.primary_lawyer
	);
	const coBorrowers = snapshot.borrowers.filter(
		(borrower) => borrower.role === "co_borrower"
	);

	const mappings: SignatoryMapping[] = [
		...(purchasingLender
			? [
					{
						platformRole: "purchasing_lender",
						name: purchasingLender.fullName,
						email: purchasingLender.email,
					},
				]
			: []),
		...(sellingLender
			? [
					{
						platformRole: "selling_lender",
						name: sellingLender.fullName,
						email: sellingLender.email,
					},
				]
			: []),
		...(borrowerPrimary
			? [
					{
						platformRole: "primary_borrower",
						name: borrowerPrimary.fullName,
						email: borrowerPrimary.email,
					},
				]
			: []),
		...(coBorrowers[0]
			? [
					{
						platformRole: "co_borrower_1",
						name: coBorrowers[0].fullName,
						email: coBorrowers[0].email,
					},
				]
			: []),
		...(coBorrowers[1]
			? [
					{
						platformRole: "co_borrower_2",
						name: coBorrowers[1].fullName,
						email: coBorrowers[1].email,
					},
				]
			: []),
		{
			platformRole: "broker_of_record",
			name: snapshot.brokerOfRecord.fullName,
			email: snapshot.brokerOfRecord.email,
		},
		...(snapshot.assignedBroker
			? [
					{
						platformRole: "assigned_broker",
						name: snapshot.assignedBroker.fullName,
						email: snapshot.assignedBroker.email,
					},
				]
			: []),
		...(lawyerPrimary
			? [
					{
						platformRole: "primary_lawyer",
						name: lawyerPrimary.fullName,
						email: lawyerPrimary.email,
					},
				]
			: []),
	].filter(hasResolvedSignatoryContact);

	return appendLegacyTemplateRoleAliases(mappings);
}

function buildSignatoryParticipants(
	snapshot: ParticipantSnapshot
): SignatoryParticipant[] {
	const purchasingLender = projectionContact(
		snapshot.dealParticipants.purchasing_lender
	);
	const sellingLender = projectionContact(
		snapshot.dealParticipants.selling_lender
	);
	const borrowerPrimary = projectionContact(
		snapshot.dealParticipants.primary_borrower
	);
	const lawyerPrimary = projectionContact(
		snapshot.dealParticipants.primary_lawyer
	);
	const primaryBorrower =
		snapshot.borrowers.find((borrower) => borrower.role === "primary") ??
		snapshot.borrowers[0];
	const coBorrowers = snapshot.borrowers.filter(
		(borrower) => borrower.role === "co_borrower"
	);

	const participants: SignatoryParticipant[] = [
		...(purchasingLender
			? [
					{
						platformRole: "purchasing_lender",
						name: purchasingLender.fullName,
						email: purchasingLender.email,
						userId:
							snapshot.dealParticipants.purchasing_lender.userId ?? undefined,
					},
				]
			: []),
		...(sellingLender
			? [
					{
						platformRole: "selling_lender",
						name: sellingLender.fullName,
						email: sellingLender.email,
						userId:
							snapshot.dealParticipants.selling_lender.userId ?? undefined,
					},
				]
			: []),
		...(borrowerPrimary
			? [
					{
						platformRole: "primary_borrower",
						name: borrowerPrimary.fullName,
						email: borrowerPrimary.email,
						userId:
							snapshot.dealParticipants.primary_borrower.userId ??
							primaryBorrower?.userId,
					},
				]
			: []),
		...(coBorrowers[0]
			? [
					{
						platformRole: "co_borrower_1",
						name: coBorrowers[0].fullName,
						email: coBorrowers[0].email,
						userId: coBorrowers[0].userId,
					},
				]
			: []),
		...(coBorrowers[1]
			? [
					{
						platformRole: "co_borrower_2",
						name: coBorrowers[1].fullName,
						email: coBorrowers[1].email,
						userId: coBorrowers[1].userId,
					},
				]
			: []),
		{
			platformRole: "broker_of_record",
			name: snapshot.brokerOfRecord.fullName,
			email: snapshot.brokerOfRecord.email,
			userId: snapshot.brokerOfRecord.userId,
		},
		...(snapshot.assignedBroker
			? [
					{
						platformRole: "assigned_broker",
						name: snapshot.assignedBroker.fullName,
						email: snapshot.assignedBroker.email,
						userId: snapshot.assignedBroker.userId,
					},
				]
			: []),
		...(lawyerPrimary
			? [
					{
						platformRole: "primary_lawyer",
						name: lawyerPrimary.fullName,
						email: lawyerPrimary.email,
					},
				]
			: []),
	].filter(hasResolvedSignatoryContact);

	return appendLegacyTemplateRoleAliases(participants);
}

function canLaunchEmbeddedSigning(args: {
	dealStatus: string | null;
	envelopeStatus: EnvelopeRow["status"] | null;
	providerRecipientId: string | null;
	recipientStatus: RecipientRow["status"];
	recipients: Pick<
		PackageInstanceSigningRecipientSurface,
		"signingOrder" | "status"
	>[];
	recipientSigningOrder: number;
	userId: Id<"users"> | null;
	viewer?: DealPackageViewerContext;
}) {
	const hasActiveEnvelope =
		args.envelopeStatus === "sent" ||
		args.envelopeStatus === "partially_signed";
	if (
		!canStartSigningForDealStatus(args.dealStatus, {
			hasActiveEnvelope,
		})
	) {
		return false;
	}

	if (!(args.viewer?.userId && args.userId)) {
		return false;
	}

	if (args.viewer.userId !== args.userId) {
		return false;
	}

	if (!args.providerRecipientId) {
		return false;
	}

	if (
		args.recipientStatus === "signed" ||
		args.recipientStatus === "declined"
	) {
		return false;
	}

	if (
		args.recipients.some(
			(recipient) =>
				recipient.signingOrder < args.recipientSigningOrder &&
				recipient.status !== "signed"
		)
	) {
		return false;
	}

	return (
		args.envelopeStatus === "sent" || args.envelopeStatus === "partially_signed"
	);
}

async function buildSigningSurface(
	ctx: Pick<QueryCtx, "db">,
	instance: Pick<
		InstanceRow,
		"generatedDocumentId" | "sourceBlueprintSnapshot"
	>,
	viewer?: DealPackageViewerContext,
	dealStatus?: string | null,
	generatedDocumentOverride?: GeneratedDocumentRow | null
): Promise<PackageInstanceSigningSurface | null> {
	if (instance.sourceBlueprintSnapshot.class !== "private_templated_signable") {
		return null;
	}

	const generatedDocumentId = instance.generatedDocumentId;
	const generatedDocument =
		generatedDocumentOverride ??
		(generatedDocumentId ? await ctx.db.get(generatedDocumentId) : null);
	let envelope: EnvelopeRow | null = null;
	if (generatedDocumentId) {
		envelope = await ctx.db
			.query("signatureEnvelopes")
			.withIndex("by_generated_document", (query) =>
				query.eq("generatedDocumentId", generatedDocumentId)
			)
			.unique();
	}
	const recipientRows = envelope
		? await ctx.db
				.query("signatureRecipients")
				.withIndex("by_envelope", (query) =>
					query.eq("envelopeId", envelope._id)
				)
				.collect()
		: [];

	const recipients = recipientRows.map((recipient) => ({
		declinedAt: recipient.declinedAt ?? null,
		email: recipient.email,
		isCurrentViewer:
			Boolean(viewer?.userId) && viewer?.userId === recipient.userId,
		name: recipient.name,
		openedAt: recipient.openedAt ?? null,
		platformRole: recipient.platformRole,
		providerRecipientId: recipient.providerRecipientId ?? null,
		providerRole: recipient.providerRole,
		signedAt: recipient.signedAt ?? null,
		signingOrder: recipient.signingOrder,
		status: recipient.status,
		userId: recipient.userId ?? null,
	}));

	return {
		canLaunchEmbeddedSigning: recipients.some((recipient) =>
			canLaunchEmbeddedSigning({
				dealStatus: dealStatus ?? null,
				envelopeStatus: envelope?.status ?? null,
				providerRecipientId: recipient.providerRecipientId,
				recipients,
				recipientStatus: recipient.status,
				recipientSigningOrder: recipient.signingOrder,
				userId: recipient.userId,
				viewer,
			})
		),
		envelopeId: envelope?._id ?? null,
		generatedDocumentSigningStatus: generatedDocument?.signingStatus ?? null,
		lastError: envelope?.lastError ?? null,
		lastProviderSyncAt: envelope?.lastProviderSyncAt ?? null,
		providerCode: envelope?.providerCode ?? null,
		providerEnvelopeId: envelope?.providerEnvelopeId ?? null,
		recipients,
		status: envelope?.status ?? null,
	};
}

async function buildPackageSurface(
	ctx: Pick<QueryCtx, "db" | "storage">,
	dealId: Id<"deals">,
	viewer?: DealPackageViewerContext
): Promise<PackageSurface> {
	const deal = await ctx.db.get(dealId);
	const participants = deal
		? await buildDealParticipantProjection(ctx, deal)
		: null;
	const packageRow = await ctx.db
		.query("dealDocumentPackages")
		.withIndex("by_deal", (query) => query.eq("dealId", dealId))
		.unique();

	if (!packageRow) {
		return { instances: [], package: null, participants };
	}

	const rows = await ctx.db
		.query("dealDocumentInstances")
		.withIndex("by_package", (query) => query.eq("packageId", packageRow._id))
		.collect();
	const [attempts, recipients, exceptions] = await Promise.all([
		ctx.db
			.query("dealEnvelopeAttempts")
			.withIndex("by_package", (query) => query.eq("packageId", packageRow._id))
			.collect(),
		ctx.db
			.query("dealEnvelopeRecipients")
			.withIndex("by_deal", (query) => query.eq("dealId", dealId))
			.collect(),
		ctx.db
			.query("dealSigningExceptions")
			.withIndex("by_package", (query) => query.eq("packageId", packageRow._id))
			.collect(),
	]);

	const instances = await Promise.all(
		rows
			.sort((left, right) => {
				if (
					left.sourceBlueprintSnapshot.displayOrder !==
					right.sourceBlueprintSnapshot.displayOrder
				) {
					return (
						left.sourceBlueprintSnapshot.displayOrder -
						right.sourceBlueprintSnapshot.displayOrder
					);
				}
				return left.createdAt - right.createdAt;
			})
			.map(async (row) => {
				let url: string | null = null;
				const generatedDocument = row.generatedDocumentId
					? await ctx.db.get(row.generatedDocumentId)
					: null;
				const signing = await buildSigningSurface(
					ctx,
					row,
					viewer,
					deal?.status ?? null,
					generatedDocument
				);
				let archivedSigning: PackageInstanceArchivedSigningSurface | null =
					null;

				if (
					generatedDocument &&
					(generatedDocument.finalPdfStorageId ||
						generatedDocument.completionCertificateStorageId ||
						generatedDocument.signingCompletedAt)
				) {
					const [finalPdfUrl, completionCertificateUrl] = await Promise.all([
						generatedDocument.finalPdfStorageId
							? ctx.storage.getUrl(generatedDocument.finalPdfStorageId)
							: Promise.resolve(null),
						generatedDocument.completionCertificateStorageId
							? ctx.storage.getUrl(
									generatedDocument.completionCertificateStorageId
								)
							: Promise.resolve(null),
					]);
					archivedSigning = {
						completionCertificateUrl,
						finalPdfUrl,
						signingCompletedAt: generatedDocument.signingCompletedAt ?? null,
					};
				}

				if (row.assetId) {
					const asset = await ctx.db.get(row.assetId);
					url = asset ? await ctx.storage.getUrl(asset.fileRef) : null;
				} else if (generatedDocument) {
					if (
						row.sourceBlueprintSnapshot.class === "private_templated_signable"
					) {
						const hasActiveEnvelope =
							signing?.status === "sent" ||
							signing?.status === "partially_signed";
						url =
							archivedSigning?.finalPdfUrl ??
							(canStartSigningForDealStatus(deal?.status, {
								hasActiveEnvelope,
							})
								? null
								: await ctx.storage.getUrl(generatedDocument.pdfStorageId));
					} else {
						url = await ctx.storage.getUrl(generatedDocument.pdfStorageId);
					}
				}

				return {
					archivedSigning,
					archivedAt: row.archivedAt ?? null,
					assetId: row.assetId ?? null,
					category: row.sourceBlueprintSnapshot.category ?? null,
					class: row.sourceBlueprintSnapshot.class,
					createdAt: row.createdAt,
					dealId: row.dealId,
					displayName: row.sourceBlueprintSnapshot.displayName,
					generatedDocumentId: row.generatedDocumentId ?? null,
					instanceId: row._id,
					kind: row.kind,
					lastError: row.lastError ?? null,
					mortgageId: row.mortgageId,
					packageId: row.packageId,
					packageKey: row.sourceBlueprintSnapshot.packageKey ?? null,
					packageLabel: row.sourceBlueprintSnapshot.packageLabel ?? null,
					remediation: buildDealDocumentRemediation({
						archivedAt: row.archivedAt ?? null,
						lastError: row.lastError ?? null,
						remediationAction: row.remediationAction ?? null,
						sourceBlueprintId: row.sourceBlueprintId ?? null,
						sourceBlueprintSnapshot: row.sourceBlueprintSnapshot,
						status: row.status,
						supersededByInstanceId: row.supersededByInstanceId ?? null,
					}),
					remediationAction: row.remediationAction ?? null,
					remediationReason: row.remediationReason ?? null,
					sourceBlueprintId: row.sourceBlueprintId ?? null,
					signingState: buildSigningStateForInstance({
						attempts,
						exceptions,
						instanceId: row._id,
						recipients,
					}),
					status: row.status,
					supersededByInstanceId: row.supersededByInstanceId ?? null,
					signing,
					templateId: row.sourceBlueprintSnapshot.templateId ?? null,
					templateVersion: row.sourceBlueprintSnapshot.templateVersion ?? null,
					url,
				};
			})
	);

	return {
		instances,
		package: {
			archivedAt: packageRow.archivedAt ?? null,
			createdAt: packageRow.createdAt,
			dealId: packageRow.dealId,
			lastError: packageRow.lastError ?? null,
			mortgageId: packageRow.mortgageId,
			packageId: packageRow._id,
			readyAt: packageRow.readyAt ?? null,
			retryCount: packageRow.retryCount,
			status: packageRow.status,
			updatedAt: packageRow.updatedAt,
		},
		participants,
	};
}

function isArchivedSignableTargetComplete(target: SignableArchiveTarget) {
	return Boolean(target.instanceArchivedAt && target.finalPdfStorageId);
}

function buildSigningStateForInstance(args: {
	attempts: Doc<"dealEnvelopeAttempts">[];
	exceptions: Doc<"dealSigningExceptions">[];
	instanceId: Id<"dealDocumentInstances">;
	recipients: Doc<"dealEnvelopeRecipients">[];
}): PackageSigningState | null {
	const instanceAttempts = args.attempts
		.filter((attempt) => attempt.dealDocumentInstanceId === args.instanceId)
		.sort((left, right) => right.attemptNumber - left.attemptNumber);
	const activeAttempt =
		instanceAttempts.find((attempt) => attempt.active) ??
		instanceAttempts[0] ??
		null;
	if (!activeAttempt) {
		return null;
	}
	const attemptRecipients = args.recipients.filter(
		(recipient) => recipient.attemptId === activeAttempt._id
	);
	const requiredRecipients = attemptRecipients.filter(
		(recipient) => recipient.required
	);
	return {
		activeAttemptId: activeAttempt.active ? activeAttempt._id : null,
		attemptNumber: activeAttempt.attemptNumber,
		completedRequiredCount: requiredRecipients.filter(
			(recipient) => recipient.signingStatus === "completed"
		).length,
		exceptionCount: args.exceptions.filter(
			(exception) =>
				exception.attemptId === activeAttempt._id && exception.status === "open"
		).length,
		providerDocumentId: activeAttempt.providerDocumentId ?? null,
		providerEnvelopeId: activeAttempt.providerEnvelopeId ?? null,
		recipientCount: attemptRecipients.length,
		requiredCount: requiredRecipients.length,
		status: activeAttempt.status,
	};
}

function summarizePackageStatus(
	rows: ReadonlyArray<
		Pick<InstanceRow, "archivedAt" | "lastError" | "status"> & {
			sourceBlueprintSnapshot: Pick<
				InstanceRow["sourceBlueprintSnapshot"],
				"class"
			>;
		}
	>
): {
	lastError?: string;
	status: DealDocumentPackageStatus;
} {
	const activeRows = rows.filter((row) => !row.archivedAt);
	const failedRows = activeRows.filter(
		(row) =>
			row.status === "generation_failed" ||
			row.status === "provider_error" ||
			row.status === "signature_pending_recipient_resolution" ||
			row.status === "signature_draft" ||
			row.status === "signature_declined" ||
			row.status === "signature_voided"
	);
	const readyRows = activeRows.filter(
		(row) =>
			row.status === "available" ||
			row.status === "signature_sent" ||
			row.status === "signature_partially_signed" ||
			row.status === "signed"
	);

	if (failedRows.length === 0) {
		return { status: "ready" };
	}

	const lastError =
		failedRows.find((row) => row.lastError && row.lastError.length > 0)
			?.lastError ?? "Document package generation failed";

	if (readyRows.length > 0) {
		return { lastError, status: "partial_failure" };
	}

	return { lastError, status: "failed" };
}

export const resolveDealParticipantSnapshotInternal = convex
	.query()
	.input({
		dealId: v.id("deals"),
	})
	.handler(async (ctx, args) => {
		return buildParticipantSnapshot(ctx, args.dealId);
	})
	.internal();

export const resolveDealDocumentVariablesInternal = convex
	.query()
	.input({
		dealId: v.id("deals"),
	})
	.handler(async (ctx, args) => {
		const snapshot = await buildParticipantSnapshot(ctx, args.dealId);
		return buildDealVariableBag(snapshot);
	})
	.internal();

export const resolveDealDocumentSignatoriesInternal = convex
	.query()
	.input({
		dealId: v.id("deals"),
	})
	.handler(async (ctx, args) => {
		const snapshot = await buildParticipantSnapshot(ctx, args.dealId);
		return buildSignatoryMappings(snapshot);
	})
	.internal();

export const getPackageByDealInternal = convex
	.query()
	.input({ dealId: v.id("deals") })
	.handler(async (ctx, args) => {
		return ctx.db
			.query("dealDocumentPackages")
			.withIndex("by_deal", (query) => query.eq("dealId", args.dealId))
			.unique();
	})
	.internal();

export const listPackageInstancesInternal = convex
	.query()
	.input({ packageId: v.id("dealDocumentPackages") })
	.handler(async (ctx, args) => {
		return ctx.db
			.query("dealDocumentInstances")
			.withIndex("by_package", (query) => query.eq("packageId", args.packageId))
			.collect();
	})
	.internal();

export const getDealDocumentInstanceRemediationTargetInternal = convex
	.query()
	.input({ instanceId: v.id("dealDocumentInstances") })
	.handler(
		async (ctx, args): Promise<DealDocumentInstanceRemediationTarget> => {
			const instance = await ctx.db.get(args.instanceId);
			if (!instance) {
				throw new ConvexError("Deal document instance not found");
			}
			const eligibility = getDealDocumentRemediationEligibility({
				archivedAt: instance.archivedAt ?? null,
				lastError: instance.lastError ?? null,
				remediationAction: instance.remediationAction ?? null,
				sourceBlueprintId: instance.sourceBlueprintId ?? null,
				sourceBlueprintSnapshot: instance.sourceBlueprintSnapshot,
				status: instance.status,
				supersededByInstanceId: instance.supersededByInstanceId ?? null,
			});
			if (eligibility !== "remediable_failed_instance") {
				throw new ConvexError("Deal document instance is not remediable");
			}

			const [packageRecord, deal, mortgage] = await Promise.all([
				ctx.db.get(instance.packageId),
				ctx.db.get(instance.dealId),
				ctx.db.get(instance.mortgageId),
			]);
			if (!packageRecord) {
				throw new ConvexError("Deal document package not found");
			}
			if (!deal) {
				throw new ConvexError("Deal not found");
			}
			if (!mortgage) {
				throw new ConvexError("Mortgage not found");
			}

			return { deal, instance, mortgage, packageRecord };
		}
	)
	.internal();

export const getLatestActiveSourceBlueprintSnapshotInternal = convex
	.query()
	.input({
		sourceBlueprintId: v.id("mortgageDocumentBlueprints"),
	})
	.handler(async (ctx, args): Promise<DealPackageBlueprintSnapshot> => {
		const blueprint = await ctx.db.get(args.sourceBlueprintId);
		if (!blueprint || blueprint.status !== "active") {
			throw new ConvexError("Active source blueprint not found");
		}

		return toDealPackageBlueprintSnapshot(blueprint);
	})
	.internal();

export const listActivePackageBlueprintInputsInternal = convex
	.query()
	.input({ mortgageId: v.id("mortgages") })
	.handler(async (ctx, args) => {
		const blueprints = await listMortgageBlueprintRows(ctx, {
			includeArchived: false,
			mortgageId: args.mortgageId,
		});
		return blueprints.filter(
			(blueprint) => blueprint.class !== "public_static"
		);
	})
	.internal();

export const listActiveDocumentPackageBlueprintSnapshotsInternal = convex
	.query()
	.input({ mortgageId: v.id("mortgages") })
	.handler(async (ctx, args): Promise<DealPackageBlueprintSnapshot[]> => {
		const application = await ctx.db
			.query("mortgagePackageApplications")
			.withIndex("by_mortgage_status", (query) =>
				query.eq("mortgageId", args.mortgageId).eq("status", "active")
			)
			.order("desc")
			.first();
		if (!application) {
			return [];
		}
		const packageVersion = await ctx.db.get(application.packageVersionId);
		if (!packageVersion) {
			return [];
		}

		const snapshots: DealPackageBlueprintSnapshot[] = [];
		for (const [itemIndex, item] of packageVersion.snapshot.items.entries()) {
			if (item.kind === "group") {
				for (const templateRef of item.templateRefs) {
					const templateVersion = await ctx.db
						.query("documentTemplateVersions")
						.withIndex("by_template", (query) =>
							query
								.eq("templateId", templateRef.templateId)
								.eq("version", templateRef.pinnedVersion)
						)
						.first();
					const template = await ctx.db.get(templateRef.templateId);
					const containsSignableFields =
						templateVersion?.snapshot.fields.some(
							(field) => field.type === "signable"
						) ?? false;
					snapshots.push({
						sourceBlueprintSnapshot: {
							class: containsSignableFields
								? "private_templated_signable"
								: "private_templated_non_signable",
							displayName: `${item.name} - ${template?.name ?? "Document"}`,
							displayOrder: item.order + templateRef.order / 100,
							envelopeBoundaryKey: `group:${item.groupVersionId}`,
							packageItemKind: "group",
							packageKey: `group:${item.groupVersionId}:${templateRef.templateId}:${templateRef.pinnedVersion}`,
							packageLabel: packageVersion.snapshot.name,
							packageVersionId: packageVersion._id,
							templateId: templateRef.templateId,
							templateVersion: templateRef.pinnedVersion,
						},
					});
				}
				continue;
			}

			if (item.kind === "standalone_template") {
				snapshots.push({
					sourceBlueprintSnapshot: {
						class: item.containsSignableFields
							? "private_templated_signable"
							: "private_templated_non_signable",
						displayName: item.label ?? item.templateName,
						displayOrder: item.order,
						envelopeBoundaryKey: item.containsSignableFields
							? `standalone:${item.templateId}:${item.templateVersion}`
							: undefined,
						packageItemKind: "standalone_template",
						packageKey: `standalone:${item.templateId}:${item.templateVersion}`,
						packageLabel: packageVersion.snapshot.name,
						packageVersionId: packageVersion._id,
						templateId: item.templateId,
						templateVersion: item.templateVersion,
					},
				});
				continue;
			}

			snapshots.push({
				assetId: item.assetId,
				sourceBlueprintSnapshot: {
					class: "private_static",
					displayName: item.label ?? item.assetName,
					displayOrder: item.order + itemIndex / 100,
					packageItemKind: "static_asset",
					packageKey: `static:${item.assetId}`,
					packageLabel: packageVersion.snapshot.name,
					packageVersionId: packageVersion._id,
				},
			});
		}

		return snapshots;
	})
	.internal();

export const getDocumentAssetInternal = convex
	.query()
	.input({ assetId: v.id("documentAssets") })
	.handler(async (ctx, args) => {
		return ctx.db.get(args.assetId);
	})
	.internal();
export const ensurePackageHeaderInternal = convex
	.mutation()
	.input({
		blueprintSnapshots: v.array(dealPackageBlueprintSnapshotValidator),
		dealId: v.id("deals"),
		incrementRetryCount: v.boolean(),
		mortgageId: v.id("mortgages"),
		now: v.number(),
	})
	.handler(async (ctx, args) => {
		const existing = await ctx.db
			.query("dealDocumentPackages")
			.withIndex("by_deal", (query) => query.eq("dealId", args.dealId))
			.unique();
		if (existing) {
			await ctx.db.patch(existing._id, {
				blueprintSnapshots:
					existing.blueprintSnapshots ?? args.blueprintSnapshots,
				lastError: undefined,
				retryCount: existing.retryCount + (args.incrementRetryCount ? 1 : 0),
				status: "pending",
				updatedAt: args.now,
			});
			return existing._id;
		}

		return ctx.db.insert("dealDocumentPackages", {
			archivedAt: undefined,
			blueprintSnapshots: args.blueprintSnapshots,
			createdAt: args.now,
			dealId: args.dealId,
			lastError: undefined,
			mortgageId: args.mortgageId,
			readyAt: undefined,
			retryCount: 0,
			status: "pending",
			updatedAt: args.now,
		});
	})
	.internal();

export const createDealDocumentInstance = convex
	.mutation()
	.input({
		archivedAt: v.optional(v.number()),
		assetId: v.optional(v.id("documentAssets")),
		createdAt: v.number(),
		dealId: v.id("deals"),
		generatedDocumentId: v.optional(v.id("generatedDocuments")),
		kind: dealDocumentInstanceKindValidator,
		lastError: v.optional(v.string()),
		mortgageId: v.id("mortgages"),
		packageId: v.id("dealDocumentPackages"),
		remediationAction: v.optional(dealDocumentStoredRemediationActionValidator),
		remediationReason: v.optional(v.string()),
		sourceBlueprintId: v.optional(v.id("mortgageDocumentBlueprints")),
		sourceBlueprintSnapshot: dealDocumentSourceBlueprintSnapshotValidator,
		status: dealDocumentInstanceStatusValidator,
		supersededByInstanceId: v.optional(v.id("dealDocumentInstances")),
		updatedAt: v.number(),
	})
	.handler(async (ctx, args) => {
		return ctx.db.insert("dealDocumentInstances", args);
	})
	.internal();

export const createDealSigningExceptionInternal = convex
	.mutation()
	.input({
		attemptId: v.optional(v.id("dealEnvelopeAttempts")),
		dealDocumentInstanceId: v.optional(v.id("dealDocumentInstances")),
		dealId: v.id("deals"),
		details: v.optional(v.record(v.string(), v.string())),
		kind: dealSigningExceptionKindValidator,
		message: v.string(),
		now: v.number(),
		packageId: v.optional(v.id("dealDocumentPackages")),
		recipientId: v.optional(v.id("dealEnvelopeRecipients")),
		severity: dealSigningExceptionSeverityValidator,
	})
	.handler(async (ctx, args) => {
		return ctx.db.insert("dealSigningExceptions", {
			attemptId: args.attemptId,
			createdAt: args.now,
			dealDocumentInstanceId: args.dealDocumentInstanceId,
			dealId: args.dealId,
			details: args.details,
			kind: args.kind,
			message: args.message,
			packageId: args.packageId,
			providerEventId: undefined,
			recipientId: args.recipientId,
			resolvedAt: undefined,
			resolvedBy: undefined,
			severity: args.severity,
			status: "open",
			updatedAt: args.now,
		});
	})
	.internal();

export const resolveOpenPreSendSigningExceptionsInternal = convex
	.mutation()
	.input({
		dealId: v.id("deals"),
		now: v.number(),
		packageId: v.id("dealDocumentPackages"),
		resolvedBy: v.string(),
	})
	.handler(async (ctx, args) => {
		const openExceptions = await ctx.db
			.query("dealSigningExceptions")
			.withIndex("by_package", (query) =>
				query.eq("packageId", args.packageId).eq("status", "open")
			)
			.collect();
		const resolvedIds: Id<"dealSigningExceptions">[] = [];
		for (const exception of openExceptions) {
			if (
				exception.dealId === args.dealId &&
				exception.kind === "pre_send_configuration_failure"
			) {
				await ctx.db.patch(exception._id, {
					resolvedAt: args.now,
					resolvedBy: args.resolvedBy,
					status: "resolved",
					updatedAt: args.now,
				});
				resolvedIds.push(exception._id);
			}
		}
		return resolvedIds;
	})
	.internal();

export const archiveDealDocumentInstance = convex
	.mutation()
	.input({
		instanceId: v.id("dealDocumentInstances"),
		now: v.number(),
		remediationAction: v.optional(dealDocumentStoredRemediationActionValidator),
		remediationReason: v.optional(v.string()),
	})
	.handler(async (ctx, args) => {
		const instance = await ctx.db.get(args.instanceId);
		if (!instance || instance.status === "archived") {
			return;
		}

		await ctx.db.patch(args.instanceId, {
			archivedAt: args.now,
			remediationAction: args.remediationAction,
			remediationReason: args.remediationReason,
			status: "archived",
			updatedAt: args.now,
		});
	})
	.internal();

export const claimDealDocumentInstanceForRemediationInternal = convex
	.mutation()
	.input({
		instanceId: v.id("dealDocumentInstances"),
		now: v.number(),
		remediationAction: dealDocumentStoredRemediationActionValidator,
		remediationReason: v.optional(v.string()),
	})
	.handler(async (ctx, args) => {
		const instance = await ctx.db.get(args.instanceId);
		if (!instance) {
			throw new ConvexError("Deal document instance not found");
		}
		const eligibility = getDealDocumentRemediationEligibility({
			archivedAt: instance.archivedAt ?? null,
			lastError: instance.lastError ?? null,
			remediationAction: instance.remediationAction ?? null,
			sourceBlueprintId: instance.sourceBlueprintId ?? null,
			sourceBlueprintSnapshot: instance.sourceBlueprintSnapshot,
			status: instance.status,
			supersededByInstanceId: instance.supersededByInstanceId ?? null,
		});
		if (eligibility !== "remediable_failed_instance") {
			throw new ConvexError("Deal document instance is not remediable");
		}

		await ctx.db.patch(args.instanceId, {
			archivedAt: args.now,
			remediationAction: args.remediationAction,
			remediationReason: args.remediationReason,
			status: "archived",
			updatedAt: args.now,
		});

		return {
			previousStatus: instance.status,
		};
	})
	.internal();

export const patchDealDocumentInstanceSupersededByInternal = convex
	.mutation()
	.input({
		instanceId: v.id("dealDocumentInstances"),
		now: v.number(),
		supersededByInstanceId: v.id("dealDocumentInstances"),
	})
	.handler(async (ctx, args) => {
		await ctx.db.patch(args.instanceId, {
			supersededByInstanceId: args.supersededByInstanceId,
			updatedAt: args.now,
		});
	})
	.internal();

function buildDealDocumentRemediationLinkedRecordIds(args: {
	instance: Pick<
		InstanceRow,
		"_id" | "mortgageId" | "packageId" | "sourceBlueprintId"
	>;
}) {
	return {
		dealDocumentInstanceId: String(args.instance._id),
		mortgageId: String(args.instance.mortgageId),
		packageId: String(args.instance.packageId),
		sourceBlueprintId: args.instance.sourceBlueprintId
			? String(args.instance.sourceBlueprintId)
			: undefined,
	};
}

function businessDateFromTimestamp(timestamp: number) {
	return new Date(timestamp).toISOString().slice(0, 10);
}

function remediationAuditEventId(args: {
	action: string;
	instanceId: Id<"dealDocumentInstances">;
	timestamp: number;
}) {
	return `${args.action}:${String(args.instanceId)}:${args.timestamp}`;
}

async function nextAuditJournalSequenceNumber(ctx: Pick<MutationCtx, "db">) {
	const existingCounter = await ctx.db
		.query("auditJournalSequenceCounters")
		.withIndex("by_name", (query) => query.eq("name", "auditJournal"))
		.unique();

	if (existingCounter) {
		const nextSequenceNumber = existingCounter.nextSequenceNumber;
		await ctx.db.patch(existingCounter._id, {
			nextSequenceNumber: nextSequenceNumber + 1n,
			updatedAt: Date.now(),
		});
		return nextSequenceNumber;
	}

	await ctx.db.insert("auditJournalSequenceCounters", {
		name: "auditJournal",
		nextSequenceNumber: 2n,
		updatedAt: Date.now(),
	});
	return 1n;
}

async function appendDealDocumentRemediationAudit(
	ctx: Pick<MutationCtx, "db">,
	args: {
		action: string;
		afterState: Record<string, unknown>;
		deal: Doc<"deals">;
		instance: InstanceRow;
		previousState: string;
		reason?: string;
		timestamp: number;
	}
) {
	await ctx.db.insert("auditJournal", {
		actorId: "system:deal-document-remediation",
		actorType: "system",
		afterState: args.afterState,
		beforeState: { status: args.previousState },
		channel: "admin_dashboard",
		delta: args.afterState,
		entityId: String(args.deal._id),
		entityType: "deal",
		effectiveDate: businessDateFromTimestamp(args.timestamp),
		eventCategory: "document_remediation",
		eventId: remediationAuditEventId({
			action: args.action,
			instanceId: args.instance._id,
			timestamp: args.timestamp,
		}),
		eventType: args.action,
		legalEntityId: args.deal.orgId,
		linkedRecordIds: buildDealDocumentRemediationLinkedRecordIds({
			instance: args.instance,
		}),
		mortgageId: String(args.instance.mortgageId),
		newState: args.afterState.status
			? String(args.afterState.status)
			: args.previousState,
		originSystem: "convex",
		organizationId: args.deal.orgId,
		outcome: "transitioned",
		payload: args.afterState,
		previousState: args.previousState,
		reason: args.reason,
		sequenceNumber: await nextAuditJournalSequenceNumber(ctx),
		timestamp: args.timestamp,
	});
}

export const appendDealDocumentRemediationAuditInternal = convex
	.mutation()
	.input({
		action: v.string(),
		afterState: v.record(v.string(), v.any()),
		dealId: v.id("deals"),
		instanceId: v.id("dealDocumentInstances"),
		previousState: v.string(),
		reason: v.optional(v.string()),
		timestamp: v.number(),
	})
	.handler(async (ctx, args) => {
		const [deal, instance] = await Promise.all([
			ctx.db.get(args.dealId),
			ctx.db.get(args.instanceId),
		]);
		if (!deal) {
			throw new ConvexError("Deal not found");
		}
		if (!instance) {
			throw new ConvexError("Deal document instance not found");
		}

		await appendDealDocumentRemediationAudit(ctx, {
			action: args.action,
			afterState: args.afterState,
			deal,
			instance,
			previousState: args.previousState,
			reason: args.reason,
			timestamp: args.timestamp,
		});
	})
	.internal();

export const insertGeneratedDocumentInternal = convex
	.mutation()
	.input({
		dealId: v.id("deals"),
		documensoEnvelopeId: v.optional(v.string()),
		groupId: v.optional(v.id("documentTemplateGroups")),
		metadata: v.optional(v.any()),
		name: v.string(),
		pdfStorageId: v.id("_storage"),
		signingStatus: v.optional(generatedDocumentSigningStatusValidator),
		templateId: v.id("documentTemplates"),
		templateVersionUsed: v.number(),
	})
	.handler(async (ctx, args) => {
		return ctx.db.insert("generatedDocuments", {
			documensoEnvelopeId: args.documensoEnvelopeId,
			entityId: String(args.dealId),
			entityType: "deal",
			generatedAt: Date.now(),
			generatedBy: "deal_document_package",
			groupId: args.groupId,
			metadata: args.metadata,
			name: args.name,
			pdfStorageId: args.pdfStorageId,
			sensitivityTier: "private",
			signingStatus: args.signingStatus ?? "not_applicable",
			templateId: args.templateId,
			templateVersionUsed: args.templateVersionUsed,
			updatedAt: Date.now(),
		});
	})
	.internal();

function buildGeneratedDocumentSigningPatch(args: {
	completionCertificateStorageId?: Id<"_storage">;
	documensoEnvelopeId?: string | null;
	finalPdfStorageId?: Id<"_storage">;
	generatedDocument: GeneratedDocumentRow;
	now: number;
	signingCompletedAt?: number;
	signingStatus: GeneratedDocumentRow["signingStatus"];
}) {
	const patch: Partial<GeneratedDocumentRow> = {
		signingStatus: args.signingStatus,
		updatedAt: args.now,
	};

	if (args.documensoEnvelopeId === null) {
		patch.documensoEnvelopeId = undefined;
	} else {
		const documensoEnvelopeId =
			args.documensoEnvelopeId ?? args.generatedDocument.documensoEnvelopeId;
		if (documensoEnvelopeId !== undefined) {
			patch.documensoEnvelopeId = documensoEnvelopeId;
		}
	}

	const signingCompletedAt =
		args.signingCompletedAt ?? args.generatedDocument.signingCompletedAt;
	if (signingCompletedAt !== undefined) {
		patch.signingCompletedAt = signingCompletedAt;
	}

	if (args.completionCertificateStorageId !== undefined) {
		patch.completionCertificateStorageId = args.completionCertificateStorageId;
	}

	if (args.finalPdfStorageId !== undefined) {
		patch.finalPdfStorageId = args.finalPdfStorageId;
	}

	return patch;
}

function buildSignatureRecipientPatch(args: {
	declinedAt?: number;
	now: number;
	openedAt?: number;
	signedAt?: number;
	status: RecipientRow["status"];
}) {
	const patch: Partial<RecipientRow> = {
		status: args.status,
		updatedAt: args.now,
	};

	if (args.declinedAt !== undefined) {
		patch.declinedAt = args.declinedAt;
	}

	if (args.openedAt !== undefined) {
		patch.openedAt = args.openedAt;
	}

	if (args.signedAt !== undefined) {
		patch.signedAt = args.signedAt;
	}

	return patch;
}

export const patchGeneratedDocumentSigningStateInternal = convex
	.mutation()
	.input({
		completionCertificateStorageId: v.optional(v.id("_storage")),
		documensoEnvelopeId: v.optional(v.union(v.string(), v.null())),
		finalPdfStorageId: v.optional(v.id("_storage")),
		generatedDocumentId: v.id("generatedDocuments"),
		now: v.number(),
		signingCompletedAt: v.optional(v.number()),
		signingStatus: generatedDocumentSigningStatusValidator,
	})
	.handler(async (ctx, args) => {
		const generatedDocument = await ctx.db.get(args.generatedDocumentId);
		if (!generatedDocument) {
			throw new ConvexError("Generated document not found");
		}

		await ctx.db.patch(
			args.generatedDocumentId,
			buildGeneratedDocumentSigningPatch({
				completionCertificateStorageId: args.completionCertificateStorageId,
				documensoEnvelopeId: args.documensoEnvelopeId,
				finalPdfStorageId: args.finalPdfStorageId,
				generatedDocument,
				now: args.now,
				signingCompletedAt: args.signingCompletedAt,
				signingStatus: args.signingStatus,
			})
		);
	})
	.internal();

export const createSignatureEnvelopeWithRecipientsInternal = convex
	.mutation()
	.input({
		dealId: v.id("deals"),
		generatedDocumentId: v.id("generatedDocuments"),
		instanceLastError: v.optional(v.string()),
		instanceStatus: v.optional(dealDocumentInstanceStatusValidator),
		lastError: v.optional(v.string()),
		mortgageId: v.optional(v.id("mortgages")),
		now: v.number(),
		packageId: v.optional(v.id("dealDocumentPackages")),
		providerCode: signatureProviderCodeValidator,
		providerEnvelopeId: v.string(),
		recipients: v.array(
			v.object({
				email: v.string(),
				name: v.string(),
				platformRole: v.string(),
				providerRecipientId: v.optional(v.string()),
				providerRole: signatureProviderRoleValidator,
				signingOrder: v.number(),
				status: signatureRecipientStatusValidator,
				userId: v.optional(v.id("users")),
			})
		),
		sourceBlueprintId: v.optional(v.id("mortgageDocumentBlueprints")),
		sourceBlueprintSnapshot: v.optional(
			dealDocumentSourceBlueprintSnapshotValidator
		),
		status: signatureEnvelopeStatusValidator,
	})
	.handler(async (ctx, args) => {
		const existingEnvelope = await ctx.db
			.query("signatureEnvelopes")
			.withIndex("by_generated_document", (query) =>
				query.eq("generatedDocumentId", args.generatedDocumentId)
			)
			.unique();
		const envelopeId =
			existingEnvelope?._id ??
			(await ctx.db.insert("signatureEnvelopes", {
				createdAt: args.now,
				dealId: args.dealId,
				generatedDocumentId: args.generatedDocumentId,
				lastError: args.lastError,
				lastProviderSyncAt: args.now,
				providerCode: args.providerCode,
				providerEnvelopeId: args.providerEnvelopeId,
				status: args.status,
				updatedAt: args.now,
			}));

		if (existingEnvelope) {
			await ctx.db.patch(existingEnvelope._id, {
				lastError: args.lastError,
				lastProviderSyncAt: args.now,
				providerCode: args.providerCode,
				providerEnvelopeId: args.providerEnvelopeId,
				status: args.status,
				updatedAt: args.now,
			});
		}

		const existingRecipients = await ctx.db
			.query("signatureRecipients")
			.withIndex("by_envelope", (query) => query.eq("envelopeId", envelopeId))
			.collect();
		if (existingRecipients.length === 0) {
			for (const recipient of args.recipients) {
				await ctx.db.insert("signatureRecipients", {
					createdAt: args.now,
					declinedAt: undefined,
					email: recipient.email,
					envelopeId,
					name: recipient.name,
					openedAt: undefined,
					platformRole: recipient.platformRole,
					providerRecipientId: recipient.providerRecipientId,
					providerRole: recipient.providerRole,
					signedAt: undefined,
					signingOrder: recipient.signingOrder,
					status: recipient.status,
					updatedAt: args.now,
					userId: recipient.userId,
				});
			}
		}

		const generatedDocument = await ctx.db.get(args.generatedDocumentId);
		if (!generatedDocument) {
			throw new ConvexError("Generated document not found");
		}

		await ctx.db.patch(
			args.generatedDocumentId,
			buildGeneratedDocumentSigningPatch({
				documensoEnvelopeId: args.providerEnvelopeId,
				generatedDocument,
				now: args.now,
				signingStatus: mapEnvelopeStatusToGeneratedDocumentSigningStatus(
					args.status
				),
			})
		);

		let instanceId: Id<"dealDocumentInstances"> | null = null;
		if (
			args.instanceStatus &&
			args.mortgageId &&
			args.packageId &&
			args.sourceBlueprintSnapshot
		) {
			instanceId = await ctx.db.insert("dealDocumentInstances", {
				archivedAt: undefined,
				createdAt: args.now,
				dealId: args.dealId,
				generatedDocumentId: args.generatedDocumentId,
				kind: "generated",
				lastError: args.instanceLastError,
				mortgageId: args.mortgageId,
				packageId: args.packageId,
				sourceBlueprintId: args.sourceBlueprintId,
				sourceBlueprintSnapshot: args.sourceBlueprintSnapshot,
				status: args.instanceStatus,
				updatedAt: args.now,
			});
		}

		return { envelopeId, instanceId };
	})
	.internal();

export const syncSignatureEnvelopeStateInternal = convex
	.mutation()
	.input({
		completionCertificateStorageId: v.optional(v.id("_storage")),
		envelopeId: v.id("signatureEnvelopes"),
		finalPdfStorageId: v.optional(v.id("_storage")),
		lastError: v.optional(v.string()),
		now: v.optional(v.number()),
		recipients: v.array(
			v.object({
				declinedAt: v.optional(v.number()),
				openedAt: v.optional(v.number()),
				providerRecipientId: v.string(),
				signedAt: v.optional(v.number()),
				status: signatureRecipientStatusValidator,
			})
		),
		status: signatureEnvelopeStatusValidator,
	})
	.handler(async (ctx, args) => {
		const envelope = await ctx.db.get(args.envelopeId);
		if (!envelope) {
			throw new ConvexError("Signature envelope not found");
		}

		const updatedAt = args.now ?? Date.now();

		await ctx.db.patch(envelope._id, {
			lastError: args.lastError,
			...(args.now !== undefined ? { lastProviderSyncAt: args.now } : {}),
			status: args.status,
			updatedAt,
		});

		const existingRecipients = await ctx.db
			.query("signatureRecipients")
			.withIndex("by_envelope", (query) => query.eq("envelopeId", envelope._id))
			.collect();
		const recipientByProviderId = new Map(
			existingRecipients
				.filter(
					(
						recipient
					): recipient is RecipientRow & { providerRecipientId: string } =>
						Boolean(recipient.providerRecipientId)
				)
				.map((recipient) => [recipient.providerRecipientId, recipient])
		);

		for (const recipientUpdate of args.recipients) {
			const recipient = recipientByProviderId.get(
				recipientUpdate.providerRecipientId
			);
			if (!recipient) {
				continue;
			}

			await ctx.db.patch(
				recipient._id,
				buildSignatureRecipientPatch({
					declinedAt: recipientUpdate.declinedAt,
					now: updatedAt,
					openedAt: recipientUpdate.openedAt,
					signedAt: recipientUpdate.signedAt,
					status: recipientUpdate.status,
				})
			);
		}

		const generatedDocument = await ctx.db.get(envelope.generatedDocumentId);
		if (generatedDocument) {
			await ctx.db.patch(
				generatedDocument._id,
				buildGeneratedDocumentSigningPatch({
					completionCertificateStorageId: args.completionCertificateStorageId,
					documensoEnvelopeId: envelope.providerEnvelopeId,
					finalPdfStorageId: args.finalPdfStorageId,
					generatedDocument,
					now: updatedAt,
					signingCompletedAt:
						args.status === "completed"
							? (generatedDocument.signingCompletedAt ?? updatedAt)
							: undefined,
					signingStatus: mapEnvelopeStatusToGeneratedDocumentSigningStatus(
						args.status
					),
				})
			);
		}

		const dealInstances = await ctx.db
			.query("dealDocumentInstances")
			.withIndex("by_deal", (query) => query.eq("dealId", envelope.dealId))
			.collect();
		const activeInstances = dealInstances.filter(
			(instance) =>
				!instance.archivedAt &&
				instance.generatedDocumentId === envelope.generatedDocumentId
		);

		for (const instance of activeInstances) {
			await ctx.db.patch(instance._id, {
				lastError: args.lastError,
				status: mapEnvelopeStatusToDealDocumentInstanceStatus(args.status),
				updatedAt,
			});
		}

		const packageId = activeInstances[0]?.packageId;
		if (!packageId) {
			return;
		}

		const packageRows = await ctx.db
			.query("dealDocumentInstances")
			.withIndex("by_package", (query) => query.eq("packageId", packageId))
			.collect();
		const summary = summarizePackageStatus(packageRows);

		await ctx.db.patch(packageId, {
			lastError: summary.lastError,
			readyAt: summary.status === "ready" ? updatedAt : undefined,
			status: summary.status,
			updatedAt,
		});
	})
	.internal();

export const recordSignatureEnvelopeSyncErrorInternal = convex
	.mutation()
	.input({
		envelopeId: v.id("signatureEnvelopes"),
		lastError: v.string(),
		now: v.number(),
	})
	.handler(async (ctx, args) => {
		const envelope = await ctx.db.get(args.envelopeId);
		if (!envelope) {
			throw new ConvexError("Signature envelope not found");
		}

		await ctx.db.patch(envelope._id, {
			lastError: args.lastError,
			lastProviderSyncAt: args.now,
			updatedAt: args.now,
		});
	})
	.internal();

export const getViewerUserByAuthIdInternal = convex
	.query()
	.input({
		authId: v.string(),
	})
	.handler(async (ctx, args) => {
		const user = await getUserByAuthId(ctx, args.authId);
		if (!user) {
			return null;
		}

		return {
			email: user.email,
			userId: user._id,
		};
	})
	.internal();

export const getSignableDocumentEnvelopeByInstanceInternal = convex
	.query()
	.input({
		dealId: v.id("deals"),
		instanceId: v.id("dealDocumentInstances"),
	})
	.handler(async (ctx, args) => {
		const instance = await ctx.db.get(args.instanceId);
		if (
			!instance ||
			instance.dealId !== args.dealId ||
			instance.archivedAt ||
			instance.sourceBlueprintSnapshot.class !== "private_templated_signable" ||
			!instance.generatedDocumentId
		) {
			return null;
		}

		const generatedDocument = await ctx.db.get(instance.generatedDocumentId);
		if (!generatedDocument) {
			return null;
		}
		const deal = await ctx.db.get(instance.dealId);

		const envelope = await ctx.db
			.query("signatureEnvelopes")
			.withIndex("by_generated_document", (query) =>
				query.eq("generatedDocumentId", generatedDocument._id)
			)
			.unique();
		if (!envelope) {
			return null;
		}

		const recipients = await ctx.db
			.query("signatureRecipients")
			.withIndex("by_envelope", (query) => query.eq("envelopeId", envelope._id))
			.collect();

		return {
			dealId: instance.dealId,
			dealStatus: deal?.status ?? null,
			envelope: {
				envelopeId: envelope._id,
				providerCode: envelope.providerCode,
				providerEnvelopeId: envelope.providerEnvelopeId,
				status: envelope.status,
			},
			generatedDocumentId: generatedDocument._id,
			instanceId: instance._id,
			recipients: recipients.map((recipient) => ({
				email: recipient.email,
				name: recipient.name,
				platformRole: recipient.platformRole,
				providerRecipientId: recipient.providerRecipientId ?? null,
				providerRole: recipient.providerRole,
				signingOrder: recipient.signingOrder,
				status: recipient.status,
				userId: recipient.userId ?? null,
			})),
		};
	})
	.internal();

export const getRetryableSignableEnvelopeStateInternal = convex
	.query()
	.input({
		generatedDocumentId: v.id("generatedDocuments"),
	})
	.handler(async (ctx, args) => {
		const generatedDocument = await ctx.db.get(args.generatedDocumentId);
		if (!generatedDocument) {
			return {
				envelope: null,
				generatedDocument: null,
			};
		}

		const envelope = await ctx.db
			.query("signatureEnvelopes")
			.withIndex("by_generated_document", (query) =>
				query.eq("generatedDocumentId", generatedDocument._id)
			)
			.unique();

		return {
			envelope,
			generatedDocument,
		};
	})
	.internal();

export const getSignableArchiveStateByDealInternal = convex
	.query()
	.input({
		dealId: v.id("deals"),
	})
	.handler(async (ctx, args): Promise<SignableArchiveState | null> => {
		const packageRow = await ctx.db
			.query("dealDocumentPackages")
			.withIndex("by_deal", (query) => query.eq("dealId", args.dealId))
			.unique();
		if (!packageRow) {
			return null;
		}

		const instances = await ctx.db
			.query("dealDocumentInstances")
			.withIndex("by_package", (query) => query.eq("packageId", packageRow._id))
			.collect();

		const targets: SignableArchiveTarget[] = [];
		for (const instance of instances) {
			if (
				instance.sourceBlueprintSnapshot.class !== "private_templated_signable"
			) {
				continue;
			}

			if (!instance.generatedDocumentId) {
				if (instance.archivedAt) {
					continue;
				}
				throw new ConvexError(
					`Signable document instance ${instance._id} is missing generatedDocumentId`
				);
			}

			const generatedDocument = await ctx.db.get(instance.generatedDocumentId);
			if (!generatedDocument) {
				if (instance.archivedAt) {
					continue;
				}
				throw new ConvexError(
					`Generated document ${instance.generatedDocumentId} not found for signable instance ${instance._id}`
				);
			}

			const envelope = await ctx.db
				.query("signatureEnvelopes")
				.withIndex("by_generated_document", (query) =>
					query.eq("generatedDocumentId", generatedDocument._id)
				)
				.unique();
			if (!envelope) {
				if (instance.archivedAt) {
					continue;
				}
				throw new ConvexError(
					`Signature envelope not found for generated document ${generatedDocument._id}`
				);
			}

			if (instance.archivedAt && envelope.status !== "completed") {
				continue;
			}

			targets.push({
				completionCertificateStorageId:
					generatedDocument.completionCertificateStorageId ?? null,
				envelopeId: envelope._id,
				envelopeStatus: envelope.status,
				finalPdfStorageId: generatedDocument.finalPdfStorageId ?? null,
				generatedDocumentId: generatedDocument._id,
				instanceArchivedAt: instance.archivedAt ?? null,
				instanceId: instance._id,
				providerCode: envelope.providerCode,
				providerEnvelopeId: envelope.providerEnvelopeId,
				signingCompletedAt: generatedDocument.signingCompletedAt ?? null,
			});
		}

		return {
			package: {
				archivedAt: packageRow.archivedAt ?? null,
				packageId: packageRow._id,
				status: packageRow.status,
			},
			targets,
		};
	})
	.internal();

export const finalizePackageInternal = convex
	.mutation()
	.input({
		lastError: v.optional(v.string()),
		now: v.number(),
		packageId: v.id("dealDocumentPackages"),
		status: dealDocumentPackageStatusValidator,
	})
	.handler(async (ctx, args) => {
		await ctx.db.patch(args.packageId, {
			lastError: args.lastError,
			readyAt: args.status === "ready" ? args.now : undefined,
			status: args.status,
			updatedAt: args.now,
		});
	})
	.internal();

export const archivePackageInternal = convex
	.mutation()
	.input({
		now: v.number(),
		packageId: v.id("dealDocumentPackages"),
	})
	.handler(async (ctx, args) => {
		const packageRow = await ctx.db.get(args.packageId);
		if (!packageRow) {
			throw new ConvexError("Deal document package not found");
		}

		await ctx.db.patch(args.packageId, {
			archivedAt: packageRow.archivedAt ?? args.now,
			lastError: undefined,
			status: "archived",
			updatedAt: args.now,
		});
	})
	.internal();

export const setPackageArchiveErrorInternal = convex
	.mutation()
	.input({
		lastError: v.string(),
		now: v.number(),
		packageId: v.id("dealDocumentPackages"),
	})
	.handler(async (ctx, args) => {
		const packageRow = await ctx.db.get(args.packageId);
		if (!packageRow) {
			throw new ConvexError("Deal document package not found");
		}

		await ctx.db.patch(args.packageId, {
			lastError: args.lastError,
			updatedAt: args.now,
		});
	})
	.internal();

export const archiveCompletedSignableDocumentsInternal = convex
	.action()
	.input({
		dealId: v.id("deals"),
	})
	.handler(
		async (ctx, args): Promise<ArchiveCompletedSignableDocumentsResult> => {
			const archiveState = (await ctx.runQuery(
				internal.documents.dealPackages.getSignableArchiveStateByDealInternal,
				{ dealId: args.dealId }
			)) as SignableArchiveState | null;
			if (!archiveState) {
				return {
					archivedCount: 0,
					packageArchived: false,
					packageId: null,
					skippedCount: 0,
					targetCount: 0,
				};
			}

			const { package: packageState, targets } = archiveState;
			if (
				targets.length > 0 &&
				targets.every(isArchivedSignableTargetComplete)
			) {
				await ctx.runMutation(
					internal.documents.dealPackages.archivePackageInternal,
					{
						now: Date.now(),
						packageId: packageState.packageId,
					}
				);

				return {
					archivedCount: 0,
					packageArchived: true,
					packageId: packageState.packageId,
					skippedCount: targets.length,
					targetCount: targets.length,
				};
			}

			const providerCache = new Map<
				EnvelopeRow["providerCode"],
				ReturnType<typeof getSignatureProvider>
			>();
			const getProviderForCode = (
				providerCode: EnvelopeRow["providerCode"]
			) => {
				const cached = providerCache.get(providerCode);
				if (cached) {
					return cached;
				}

				const provider = getSignatureProvider(providerCode, {
					fetchFn: fetch,
					getStorageBlob: async () => null,
				});
				providerCache.set(providerCode, provider);
				return provider;
			};

			let archivedCount = 0;
			let skippedCount = 0;

			try {
				for (const target of targets) {
					if (isArchivedSignableTargetComplete(target)) {
						skippedCount += 1;
						continue;
					}

					if (target.envelopeStatus !== "completed") {
						throw new ConvexError(
							`Cannot archive signable document ${target.instanceId}; envelope ${target.providerEnvelopeId} is ${target.envelopeStatus}`
						);
					}

					const now = Date.now();
					let finalPdfStorageId = target.finalPdfStorageId;
					let completionCertificateStorageId =
						target.completionCertificateStorageId;

					if (!(finalPdfStorageId && completionCertificateStorageId)) {
						const provider = getProviderForCode(target.providerCode);
						const artifacts = await provider.downloadCompletedArtifacts({
							providerEnvelopeId: target.providerEnvelopeId,
						});

						if (!finalPdfStorageId) {
							finalPdfStorageId = await ctx.storage.store(
								new Blob([artifacts.finalPdfBytes], {
									type: "application/pdf",
								})
							);
						}

						if (
							!completionCertificateStorageId &&
							artifacts.completionCertificateBytes
						) {
							completionCertificateStorageId = await ctx.storage.store(
								new Blob([artifacts.completionCertificateBytes], {
									type: "application/pdf",
								})
							);
						}
					}

					await ctx.runMutation(
						internal.documents.dealPackages
							.patchGeneratedDocumentSigningStateInternal,
						{
							completionCertificateStorageId:
								completionCertificateStorageId ?? undefined,
							documensoEnvelopeId: target.providerEnvelopeId,
							finalPdfStorageId: finalPdfStorageId ?? undefined,
							generatedDocumentId: target.generatedDocumentId,
							now,
							signingCompletedAt: target.signingCompletedAt ?? now,
							signingStatus: "completed",
						}
					);

					if (!target.instanceArchivedAt) {
						await ctx.runMutation(
							internal.documents.dealPackages.archiveDealDocumentInstance,
							{
								instanceId: target.instanceId,
								now,
							}
						);
					}

					archivedCount += 1;
				}

				const refreshedArchiveState = (await ctx.runQuery(
					internal.documents.dealPackages.getSignableArchiveStateByDealInternal,
					{ dealId: args.dealId }
				)) as SignableArchiveState | null;
				const packageArchived: boolean = Boolean(
					refreshedArchiveState &&
						refreshedArchiveState.targets.length > 0 &&
						refreshedArchiveState.targets.every(
							isArchivedSignableTargetComplete
						)
				);

				if (refreshedArchiveState && packageArchived) {
					await ctx.runMutation(
						internal.documents.dealPackages.archivePackageInternal,
						{
							now: Date.now(),
							packageId: refreshedArchiveState.package.packageId,
						}
					);
				}

				return {
					archivedCount,
					packageArchived,
					packageId: packageState.packageId,
					skippedCount,
					targetCount: targets.length,
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				await ctx.runMutation(
					internal.documents.dealPackages.setPackageArchiveErrorInternal,
					{
						lastError: message,
						now: Date.now(),
						packageId: packageState.packageId,
					}
				);
				throw error;
			}
		}
	)
	.internal();

function getWorkItemSourceBlueprintSnapshot(
	workItem: PackageWorkItem
): DealDocumentSourceBlueprintSnapshot {
	if (workItem.type === "snapshot") {
		return workItem.snapshot.sourceBlueprintSnapshot;
	}

	return workItem.instance.sourceBlueprintSnapshot;
}

function getWorkItemSourceBlueprintId(workItem: PackageWorkItem) {
	if (workItem.type === "snapshot") {
		return workItem.snapshot.sourceBlueprintId;
	}

	return workItem.instance.sourceBlueprintId;
}

function getWorkItemAssetId(workItem: PackageWorkItem) {
	if (workItem.type === "snapshot") {
		return workItem.snapshot.assetId;
	}

	return workItem.instance.assetId;
}

function buildCreateDocumentPackageResult(args: {
	dealId: Id<"deals">;
	packageId: Id<"dealDocumentPackages">;
	status: DealDocumentPackageStatus;
}): CreateDocumentPackageResult {
	return {
		dealId: args.dealId,
		packageId: args.packageId,
		status: args.status,
	};
}

function isInstanceForSnapshot(
	instance: Pick<
		InstanceRow,
		"archivedAt" | "assetId" | "sourceBlueprintId" | "sourceBlueprintSnapshot"
	>,
	snapshot: DealPackageBlueprintSnapshot
) {
	if (instance.archivedAt) {
		return false;
	}

	if (instance.sourceBlueprintId && snapshot.sourceBlueprintId) {
		return instance.sourceBlueprintId === snapshot.sourceBlueprintId;
	}

	return (
		instance.assetId === (snapshot.assetId ?? undefined) &&
		instance.sourceBlueprintSnapshot.class ===
			snapshot.sourceBlueprintSnapshot.class &&
		instance.sourceBlueprintSnapshot.displayName ===
			snapshot.sourceBlueprintSnapshot.displayName &&
		instance.sourceBlueprintSnapshot.displayOrder ===
			snapshot.sourceBlueprintSnapshot.displayOrder &&
		instance.sourceBlueprintSnapshot.packageKey ===
			snapshot.sourceBlueprintSnapshot.packageKey &&
		instance.sourceBlueprintSnapshot.templateId ===
			snapshot.sourceBlueprintSnapshot.templateId &&
		instance.sourceBlueprintSnapshot.templateVersion ===
			snapshot.sourceBlueprintSnapshot.templateVersion
	);
}

function buildPackageWorkItems(args: {
	blueprintSnapshots: DealPackageBlueprintSnapshot[];
	dealStatus: string | null | undefined;
	existingInstances: InstanceRow[];
}): PackageWorkItem[] {
	const retryItems = args.existingInstances
		.filter(
			(instance) =>
				instance.status === "generation_failed" ||
				instance.status === "provider_error" ||
				instance.status === "signature_pending_recipient_resolution" ||
				instance.status === "signature_draft" ||
				instance.status === "signature_declined" ||
				instance.status === "signature_voided" ||
				(args.dealStatus === "documentReview.pending" &&
					instance.status === "available" &&
					instance.sourceBlueprintSnapshot.class ===
						"private_templated_signable")
		)
		.map((instance) => ({
			instance,
			type: "instance_retry" as const,
		}));

	const missingSnapshotItems = args.blueprintSnapshots
		.filter(
			(snapshot) =>
				!args.existingInstances.some((instance) =>
					isInstanceForSnapshot(instance, snapshot)
				)
		)
		.map((snapshot) => ({
			snapshot,
			type: "snapshot" as const,
		}));

	return [...retryItems, ...missingSnapshotItems].sort((left, right) => {
		const leftSnapshot = getWorkItemSourceBlueprintSnapshot(left);
		const rightSnapshot = getWorkItemSourceBlueprintSnapshot(right);
		if (leftSnapshot.displayOrder !== rightSnapshot.displayOrder) {
			return leftSnapshot.displayOrder - rightSnapshot.displayOrder;
		}
		return leftSnapshot.displayName.localeCompare(rightSnapshot.displayName);
	});
}

async function createPackageInstance(
	ctx: DealPackageActionCtx,
	args: {
		assetId?: Id<"documentAssets">;
		dealId: Id<"deals">;
		generatedDocumentId?: Id<"generatedDocuments">;
		kind: Doc<"dealDocumentInstances">["kind"];
		lastError?: string;
		mortgageId: Id<"mortgages">;
		packageId: Id<"dealDocumentPackages">;
		sourceBlueprintId?: Id<"mortgageDocumentBlueprints">;
		sourceBlueprintSnapshot: DealDocumentSourceBlueprintSnapshot;
		status: Doc<"dealDocumentInstances">["status"];
	}
) {
	const now = Date.now();
	return ctx.runMutation(
		internal.documents.dealPackages.createDealDocumentInstance,
		{
			archivedAt: undefined,
			assetId: args.assetId,
			createdAt: now,
			dealId: args.dealId,
			generatedDocumentId: args.generatedDocumentId,
			kind: args.kind,
			lastError: args.lastError,
			mortgageId: args.mortgageId,
			packageId: args.packageId,
			sourceBlueprintId: args.sourceBlueprintId,
			sourceBlueprintSnapshot: args.sourceBlueprintSnapshot,
			status: args.status,
			updatedAt: now,
		}
	);
}

async function archiveRetryInstanceIfNeeded(
	ctx: DealPackageActionCtx,
	workItem: PackageWorkItem,
	args?: {
		remediationAction?: DealDocumentStoredRemediationAction;
	}
) {
	if (workItem.type !== "instance_retry") {
		return;
	}

	await ctx.runMutation(
		internal.documents.dealPackages.archiveDealDocumentInstance,
		{
			instanceId: workItem.instance._id,
			now: Date.now(),
			remediationAction: args?.remediationAction,
		}
	);
}

function isRecipientResolutionError(error: unknown) {
	return (
		error instanceof Error && SIGNATORY_MAPPING_ERROR_RE.test(error.message)
	);
}

async function insertGeneratedDocumentRecord(
	ctx: DealPackageActionCtx,
	runtime: DealPackageRuntimeState,
	workItem: PackageWorkItem,
	sourceBlueprintSnapshot: DealDocumentSourceBlueprintSnapshot,
	args: {
		documensoEnvelopeId?: string;
		pdfRef: Id<"_storage">;
		signingStatus?: GeneratedDocumentRow["signingStatus"];
		templateVersionUsed: number;
	}
) {
	if (!sourceBlueprintSnapshot.templateId) {
		throw new ConvexError("Generated package instance is missing a templateId");
	}

	return ctx.runMutation(
		internal.documents.dealPackages.insertGeneratedDocumentInternal,
		{
			dealId: runtime.dealId,
			documensoEnvelopeId: args.documensoEnvelopeId,
			groupId: undefined,
			metadata: buildGeneratedDocumentMetadata({
				packageId: runtime.packageId,
				sourceBlueprintId: getWorkItemSourceBlueprintId(workItem),
			}),
			name: sourceBlueprintSnapshot.displayName,
			pdfStorageId: args.pdfRef,
			signingStatus: args.signingStatus,
			templateId: sourceBlueprintSnapshot.templateId,
			templateVersionUsed:
				sourceBlueprintSnapshot.templateVersion ?? args.templateVersionUsed,
		}
	);
}

async function createStaticReferenceInstance(
	ctx: DealPackageActionCtx,
	runtime: DealPackageRuntimeState,
	workItem: PackageWorkItem,
	sourceBlueprintSnapshot: DealDocumentSourceBlueprintSnapshot
) {
	const assetId = getWorkItemAssetId(workItem);
	if (!assetId) {
		return createPackageInstance(ctx, {
			dealId: runtime.dealId,
			kind: "static_reference",
			lastError: "Static blueprint is missing its source asset",
			mortgageId: runtime.mortgageId,
			packageId: runtime.packageId,
			sourceBlueprintId: getWorkItemSourceBlueprintId(workItem),
			sourceBlueprintSnapshot,
			status: "generation_failed",
		});
	}

	const asset = await ctx.runQuery(
		internal.documents.dealPackages.getDocumentAssetInternal,
		{
			assetId,
		}
	);
	if (!asset) {
		return createPackageInstance(ctx, {
			dealId: runtime.dealId,
			kind: "static_reference",
			lastError: "Static blueprint source asset record not found",
			mortgageId: runtime.mortgageId,
			packageId: runtime.packageId,
			sourceBlueprintId: getWorkItemSourceBlueprintId(workItem),
			sourceBlueprintSnapshot,
			status: "generation_failed",
		});
	}

	return createPackageInstance(ctx, {
		assetId,
		dealId: runtime.dealId,
		kind: "static_reference",
		mortgageId: runtime.mortgageId,
		packageId: runtime.packageId,
		sourceBlueprintId: getWorkItemSourceBlueprintId(workItem),
		sourceBlueprintSnapshot,
		status: "available",
	});
}

function buildTemplateGenerationFailureMessage(args: {
	missingVariables: string[];
}) {
	if (args.missingVariables.length > 0) {
		return `Missing variables: ${args.missingVariables.join(", ")}`;
	}

	return "Template generation failed";
}

function applyVariableMappingOverrides(args: {
	sourceBlueprintSnapshot: DealDocumentSourceBlueprintSnapshot;
	variableBag: Record<string, string>;
}) {
	const overrides = new Map(
		(args.sourceBlueprintSnapshot.mappingOverrides?.variables ?? []).map(
			(row) => [row.templateVariableKey, row.dealVariableKey]
		)
	);
	const mappedVariables: Record<string, string> = {};
	for (const [templateVariableKey, dealVariableKey] of overrides) {
		const value = args.variableBag[dealVariableKey];
		if (typeof value === "string") {
			mappedVariables[templateVariableKey] = value;
		}
	}
	return {
		...args.variableBag,
		...mappedVariables,
	};
}

function applySignatoryMappingOverrides(args: {
	sourceBlueprintSnapshot: DealDocumentSourceBlueprintSnapshot;
	signatoryMapping: Array<{
		platformRole: string;
		name: string;
		email: string;
	}>;
}) {
	const participantsByRole = new Map(
		args.signatoryMapping.map((participant) => [
			participant.platformRole,
			participant,
		])
	);
	const overrides =
		args.sourceBlueprintSnapshot.mappingOverrides?.signatories ?? [];
	const mapped = [...args.signatoryMapping];
	for (const override of overrides) {
		const participant = participantsByRole.get(override.dealParticipantRole);
		if (participant) {
			mapped.push({
				...participant,
				platformRole: override.templatePlatformRole,
			});
		}
	}
	return mapped;
}

function buildGeneratedDocumentMetadata(args: {
	packageId: Id<"dealDocumentPackages">;
	sourceBlueprintId?: Id<"mortgageDocumentBlueprints">;
}) {
	return {
		packageId: String(args.packageId),
		sourceBlueprintId: args.sourceBlueprintId
			? String(args.sourceBlueprintId)
			: undefined,
	};
}

async function createPendingRecipientResolutionInstance(
	ctx: DealPackageActionCtx,
	runtime: DealPackageRuntimeState,
	workItem: PackageWorkItem,
	sourceBlueprintSnapshot: DealDocumentSourceBlueprintSnapshot,
	message: string
) {
	return createPackageInstance(ctx, {
		dealId: runtime.dealId,
		kind: "generated",
		lastError: message,
		mortgageId: runtime.mortgageId,
		packageId: runtime.packageId,
		sourceBlueprintId: getWorkItemSourceBlueprintId(workItem),
		sourceBlueprintSnapshot,
		status: "signature_pending_recipient_resolution",
	});
}

async function createGeneratedFailureInstance(
	ctx: DealPackageActionCtx,
	runtime: DealPackageRuntimeState,
	workItem: PackageWorkItem,
	sourceBlueprintSnapshot: DealDocumentSourceBlueprintSnapshot,
	message: string
) {
	return createPackageInstance(ctx, {
		dealId: runtime.dealId,
		kind: "generated",
		lastError: message,
		mortgageId: runtime.mortgageId,
		packageId: runtime.packageId,
		sourceBlueprintId: getWorkItemSourceBlueprintId(workItem),
		sourceBlueprintSnapshot,
		status: "generation_failed",
	});
}

async function createGeneratedSuccessInstance(
	ctx: DealPackageActionCtx,
	runtime: DealPackageRuntimeState,
	workItem: PackageWorkItem,
	sourceBlueprintSnapshot: DealDocumentSourceBlueprintSnapshot,
	args: {
		pdfRef: Id<"_storage">;
		templateVersionUsed: number;
	}
) {
	if (!sourceBlueprintSnapshot.templateId) {
		throw new ConvexError("Generated package instance is missing a templateId");
	}

	const generatedDocumentId = await insertGeneratedDocumentRecord(
		ctx,
		runtime,
		workItem,
		sourceBlueprintSnapshot,
		{
			pdfRef: args.pdfRef,
			signingStatus: "not_applicable",
			templateVersionUsed: args.templateVersionUsed,
		}
	);

	return createPackageInstance(ctx, {
		dealId: runtime.dealId,
		generatedDocumentId,
		kind: "generated",
		mortgageId: runtime.mortgageId,
		packageId: runtime.packageId,
		sourceBlueprintId: getWorkItemSourceBlueprintId(workItem),
		sourceBlueprintSnapshot,
		status: "available",
	});
}

function toSignatureProviderRecipients(
	recipients: Array<{
		email: string;
		fields: Array<{
			fieldMeta?: {
				helpText?: string;
				placeholder?: string;
				readOnly?: boolean;
			};
			height: number;
			pageNumber: number;
			positionX: number;
			positionY: number;
			required: boolean;
			type: string;
			width: number;
		}>;
		name: string;
		platformRole: string;
		role: "APPROVER" | "SIGNER" | "VIEWER";
		signingOrder: number;
	}>
): SignatureProviderRecipientInput[] {
	return recipients.map((recipient) => ({
		email: recipient.email,
		fields: recipient.fields.map((field) => ({
			fieldMeta: field.fieldMeta,
			height: field.height,
			pageNumber: field.pageNumber,
			positionX: field.positionX,
			positionY: field.positionY,
			required: field.required,
			type: field.type,
			width: field.width,
		})),
		name: recipient.name,
		platformRole: recipient.platformRole,
		providerRole: recipient.role,
		signingOrder: recipient.signingOrder,
	}));
}

export function buildEnvelopeRecipientRows(args: {
	createEnvelopeResult: SignatureProviderCreateEnvelopeResult;
	runtime: DealPackageRuntimeState;
	signatureRecipients: SignatureProviderRecipientInput[];
}) {
	const participantsByEmail = new Map(
		args.runtime.signatoryParticipants.map((participant) => [
			participant.email.toLowerCase(),
			participant,
		])
	);
	const participantsByRole = new Map(
		args.runtime.signatoryParticipants.map((participant) => [
			participant.platformRole,
			participant,
		])
	);
	const providerRecipientsByRole = new Map(
		args.createEnvelopeResult.recipients.map((recipient) => [
			recipient.platformRole,
			recipient,
		])
	);

	return args.signatureRecipients.map((recipient) => {
		const providerRecipient = providerRecipientsByRole.get(
			recipient.platformRole
		);
		const participant =
			participantsByEmail.get(recipient.email.toLowerCase()) ??
			participantsByRole.get(recipient.platformRole);
		return {
			email: recipient.email,
			name: recipient.name,
			platformRole: recipient.platformRole,
			providerRecipientId: providerRecipient?.providerRecipientId,
			providerRole: recipient.providerRole,
			signingOrder: recipient.signingOrder,
			status: "pending" as const,
			userId: participant?.userId,
		};
	});
}

async function deleteRemoteEnvelopeAfterPersistenceFailure(args: {
	provider: ReturnType<typeof getSignatureProvider>;
	providerEnvelopeId: string;
}) {
	try {
		await args.provider.deleteEnvelope({
			providerEnvelopeId: args.providerEnvelopeId,
		});
		return null;
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}

function buildEnvelopeRecipientRowsFromSyncResult(args: {
	runtime: DealPackageRuntimeState;
	syncRecipients: SignatureProviderSyncEnvelopeResult["recipients"];
}) {
	const participantsByEmail = new Map(
		args.runtime.signatoryParticipants.map((participant) => [
			participant.email.toLowerCase(),
			participant,
		])
	);

	return args.syncRecipients.map((recipient) => {
		const participant = participantsByEmail.get(recipient.email.toLowerCase());
		if (!participant) {
			throw new ConvexError(
				`Unable to map synced recipient ${recipient.email} back to a platform participant`
			);
		}

		return {
			email: recipient.email,
			name: recipient.name,
			platformRole: participant.platformRole,
			providerRecipientId: recipient.providerRecipientId,
			providerRole: recipient.providerRole,
			signingOrder: recipient.signingOrder,
			status: recipient.status,
			userId: participant.userId,
		};
	});
}

function toSyncEnvelopeMutationRecipients(
	recipients: SignatureProviderSyncEnvelopeResult["recipients"]
) {
	return recipients.map((recipient) => ({
		declinedAt: recipient.declinedAt,
		openedAt: recipient.openedAt,
		providerRecipientId: recipient.providerRecipientId,
		signedAt: recipient.signedAt,
		status: recipient.status,
	}));
}

async function retryExistingSignableEnvelopeIfNeeded(
	ctx: DealPackageActionCtx,
	runtime: DealPackageRuntimeState,
	workItem: PackageWorkItem
) {
	if (
		workItem.type !== "instance_retry" ||
		!workItem.instance.generatedDocumentId
	) {
		return false;
	}

	const retryState = await ctx.runQuery(
		internal.documents.dealPackages.getRetryableSignableEnvelopeStateInternal,
		{
			generatedDocumentId: workItem.instance.generatedDocumentId,
		}
	);
	if (!retryState.generatedDocument?.documensoEnvelopeId) {
		return false;
	}

	const provider = getSignatureProvider("documenso", {
		fetchFn: fetch,
		getStorageBlob: (storageId) => ctx.storage.get(storageId),
	});

	if (retryState.envelope?.status === "draft") {
		await provider.distributeEnvelope({
			providerEnvelopeId: retryState.envelope.providerEnvelopeId,
		});

		const syncResult = await provider.syncEnvelope({
			providerEnvelopeId: retryState.envelope.providerEnvelopeId,
		});

		await ctx.runMutation(
			internal.documents.dealPackages.syncSignatureEnvelopeStateInternal,
			{
				envelopeId: retryState.envelope._id,
				lastError: undefined,
				now: Date.now(),
				recipients: toSyncEnvelopeMutationRecipients(syncResult.recipients),
				status: syncResult.envelopeStatus,
			}
		);

		return true;
	}

	if (retryState.envelope) {
		return false;
	}

	const syncResult = await provider.syncEnvelope({
		providerEnvelopeId: retryState.generatedDocument.documensoEnvelopeId,
	});
	const now = Date.now();
	const envelopeResult = await ctx.runMutation(
		internal.documents.dealPackages
			.createSignatureEnvelopeWithRecipientsInternal,
		{
			dealId: runtime.dealId,
			generatedDocumentId: retryState.generatedDocument._id,
			lastError: undefined,
			now,
			providerCode: "documenso",
			providerEnvelopeId: retryState.generatedDocument.documensoEnvelopeId,
			recipients: buildEnvelopeRecipientRowsFromSyncResult({
				runtime,
				syncRecipients: syncResult.recipients,
			}),
			status: syncResult.envelopeStatus,
		}
	);

	await ctx.runMutation(
		internal.documents.dealPackages.syncSignatureEnvelopeStateInternal,
		{
			envelopeId: envelopeResult.envelopeId,
			lastError: undefined,
			now,
			recipients: toSyncEnvelopeMutationRecipients(syncResult.recipients),
			status: syncResult.envelopeStatus,
		}
	);

	return true;
}

async function createSignableGeneratedInstance(
	ctx: DealPackageActionCtx,
	runtime: DealPackageRuntimeState,
	workItem: PackageWorkItem,
	sourceBlueprintSnapshot: DealDocumentSourceBlueprintSnapshot
) {
	if (!sourceBlueprintSnapshot.templateId) {
		return createGeneratedFailureInstance(
			ctx,
			runtime,
			workItem,
			sourceBlueprintSnapshot,
			"Signable generated package instance is missing a templateId"
		);
	}

	try {
		const signatoryMapping = applySignatoryMappingOverrides({
			signatoryMapping: runtime.signatories,
			sourceBlueprintSnapshot,
		});
		const variables = applyVariableMappingOverrides({
			sourceBlueprintSnapshot,
			variableBag: runtime.variables,
		});
		const generationResult = await ctx.runAction(
			internal.documentEngine.generation.generateSingleTemplate,
			{
				pinnedVersion: sourceBlueprintSnapshot.templateVersion ?? undefined,
				signatoryMapping,
				templateId: sourceBlueprintSnapshot.templateId,
				variables,
			}
		);

		if (!(generationResult.success && generationResult.pdfRef)) {
			return createGeneratedFailureInstance(
				ctx,
				runtime,
				workItem,
				sourceBlueprintSnapshot,
				buildTemplateGenerationFailureMessage({
					missingVariables: generationResult.missingVariables,
				})
			);
		}

		const signatureRecipients = toSignatureProviderRecipients(
			generationResult.documensoConfig?.recipients ?? []
		);
		const generatedDocumentId = await insertGeneratedDocumentRecord(
			ctx,
			runtime,
			workItem,
			sourceBlueprintSnapshot,
			{
				pdfRef: generationResult.pdfRef,
				signingStatus: "draft",
				templateVersionUsed: generationResult.templateVersionUsed,
			}
		);
		if (!canStartSigningForDealStatus(runtime.dealStatus)) {
			return createPackageInstance(ctx, {
				dealId: runtime.dealId,
				generatedDocumentId,
				kind: "generated",
				mortgageId: runtime.mortgageId,
				packageId: runtime.packageId,
				sourceBlueprintId: getWorkItemSourceBlueprintId(workItem),
				sourceBlueprintSnapshot,
				status: "available",
			});
		}
		if (signatureRecipients.length === 0) {
			return createPackageInstance(ctx, {
				dealId: runtime.dealId,
				generatedDocumentId,
				kind: "generated",
				lastError: EMPTY_SIGNABLE_RECIPIENTS_ERROR,
				mortgageId: runtime.mortgageId,
				packageId: runtime.packageId,
				sourceBlueprintId: getWorkItemSourceBlueprintId(workItem),
				sourceBlueprintSnapshot,
				status: "signature_pending_recipient_resolution",
			});
		}
		let provider: ReturnType<typeof getSignatureProvider> | null = null;
		let createdEnvelope: SignatureProviderCreateEnvelopeResult | null = null;

		try {
			provider = getSignatureProvider("documenso", {
				fetchFn: fetch,
				getStorageBlob: (storageId) => ctx.storage.get(storageId),
			});
			createdEnvelope = await provider.createEnvelope({
				dealId: runtime.dealId,
				generatedDocumentId,
				pdfStorageId: generationResult.pdfRef,
				recipients: signatureRecipients,
				title: sourceBlueprintSnapshot.displayName,
			});
			const now = Date.now();

			await ctx.runMutation(
				internal.documents.dealPackages
					.patchGeneratedDocumentSigningStateInternal,
				{
					documensoEnvelopeId: createdEnvelope.providerEnvelopeId,
					generatedDocumentId,
					now,
					signingStatus: mapEnvelopeStatusToGeneratedDocumentSigningStatus(
						createdEnvelope.status
					),
				}
			);

			const envelopeResult = await ctx.runMutation(
				internal.documents.dealPackages
					.createSignatureEnvelopeWithRecipientsInternal,
				{
					dealId: runtime.dealId,
					generatedDocumentId,
					instanceLastError: createdEnvelope.lastError,
					instanceStatus: mapEnvelopeStatusToDealDocumentInstanceStatus(
						createdEnvelope.status
					),
					lastError: createdEnvelope.lastError,
					mortgageId: runtime.mortgageId,
					now,
					packageId: runtime.packageId,
					providerCode: "documenso",
					providerEnvelopeId: createdEnvelope.providerEnvelopeId,
					recipients: buildEnvelopeRecipientRows({
						createEnvelopeResult: createdEnvelope,
						runtime,
						signatureRecipients,
					}),
					sourceBlueprintId: getWorkItemSourceBlueprintId(workItem),
					sourceBlueprintSnapshot,
					status: createdEnvelope.status,
				}
			);
			await ctx.runMutation(
				internal.documents.dealPackages
					.resolveOpenPreSendSigningExceptionsInternal,
				{
					dealId: runtime.dealId,
					now,
					packageId: runtime.packageId,
					resolvedBy: "system:document-package-signing-ready",
				}
			);
			return envelopeResult.instanceId;
		} catch (error) {
			const cleanupError =
				createdEnvelope && provider
					? await deleteRemoteEnvelopeAfterPersistenceFailure({
							provider,
							providerEnvelopeId: createdEnvelope.providerEnvelopeId,
						})
					: null;
			const message = providerFailureLastError(error);
			await ctx.runMutation(
				internal.documents.dealPackages
					.patchGeneratedDocumentSigningStateInternal,
				{
					documensoEnvelopeId:
						createdEnvelope && !cleanupError
							? null
							: createdEnvelope?.providerEnvelopeId,
					generatedDocumentId,
					now: Date.now(),
					signingStatus:
						createdEnvelope && !cleanupError ? "draft" : "provider_error",
				}
			);
			const instanceId = await createPackageInstance(ctx, {
				dealId: runtime.dealId,
				generatedDocumentId,
				kind: "generated",
				lastError:
					createdEnvelope && cleanupError
						? truncateProviderDiagnostic(
								`${message}. Remote envelope cleanup failed: ${cleanupError}`
							)
						: message,
				mortgageId: runtime.mortgageId,
				packageId: runtime.packageId,
				sourceBlueprintId: getWorkItemSourceBlueprintId(workItem),
				sourceBlueprintSnapshot,
				status: "generation_failed",
			});
			if (!createdEnvelope) {
				const now = Date.now();
				await ctx.runMutation(
					internal.documents.dealPackages.createDealSigningExceptionInternal,
					{
						dealDocumentInstanceId: instanceId,
						dealId: runtime.dealId,
						details: {
							error: truncateProviderDiagnostic(stringifyUnknownError(error)),
							provider: "documenso",
						},
						kind: "pre_send_configuration_failure",
						message: DOCUMENSO_PROVIDER_PREFLIGHT_OR_CREATE_FAILED_MESSAGE,
						now,
						packageId: runtime.packageId,
						severity: "blocking",
					}
				);
			}
			return instanceId;
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (isRecipientResolutionError(error)) {
			return createPendingRecipientResolutionInstance(
				ctx,
				runtime,
				workItem,
				sourceBlueprintSnapshot,
				message
			);
		}

		return createGeneratedFailureInstance(
			ctx,
			runtime,
			workItem,
			sourceBlueprintSnapshot,
			message
		);
	}
}

async function createNonSignableGeneratedInstance(
	ctx: DealPackageActionCtx,
	runtime: DealPackageRuntimeState,
	workItem: PackageWorkItem,
	sourceBlueprintSnapshot: DealDocumentSourceBlueprintSnapshot
) {
	if (!sourceBlueprintSnapshot.templateId) {
		return createGeneratedFailureInstance(
			ctx,
			runtime,
			workItem,
			sourceBlueprintSnapshot,
			"Generated package instance is missing a templateId"
		);
	}

	try {
		const signatoryMapping = applySignatoryMappingOverrides({
			signatoryMapping: runtime.signatories,
			sourceBlueprintSnapshot,
		});
		const variables = applyVariableMappingOverrides({
			sourceBlueprintSnapshot,
			variableBag: runtime.variables,
		});
		const generationResult = await ctx.runAction(
			internal.documentEngine.generation.generateSingleTemplate,
			{
				pinnedVersion: sourceBlueprintSnapshot.templateVersion ?? undefined,
				signatoryMapping,
				templateId: sourceBlueprintSnapshot.templateId,
				variables,
			}
		);

		if (!(generationResult.success && generationResult.pdfRef)) {
			return createGeneratedFailureInstance(
				ctx,
				runtime,
				workItem,
				sourceBlueprintSnapshot,
				buildTemplateGenerationFailureMessage({
					missingVariables: generationResult.missingVariables,
				})
			);
		}

		return createGeneratedSuccessInstance(
			ctx,
			runtime,
			workItem,
			sourceBlueprintSnapshot,
			{
				pdfRef: generationResult.pdfRef,
				templateVersionUsed: generationResult.templateVersionUsed,
			}
		);
	} catch (error) {
		return createGeneratedFailureInstance(
			ctx,
			runtime,
			workItem,
			sourceBlueprintSnapshot,
			error instanceof Error ? error.message : String(error)
		);
	}
}

async function processPackageWorkItem(
	ctx: DealPackageActionCtx,
	runtime: DealPackageRuntimeState,
	workItem: PackageWorkItem,
	args?: {
		remediationAction?: DealDocumentStoredRemediationAction;
	}
): Promise<Id<"dealDocumentInstances"> | null> {
	const sourceBlueprintSnapshot = getWorkItemSourceBlueprintSnapshot(workItem);
	if (sourceBlueprintSnapshot.class === "private_templated_signable") {
		if (!args?.remediationAction) {
			const reusedEnvelope = await retryExistingSignableEnvelopeIfNeeded(
				ctx,
				runtime,
				workItem
			);
			if (reusedEnvelope) {
				return null;
			}
		}

		await archiveRetryInstanceIfNeeded(ctx, workItem, {
			remediationAction: args?.remediationAction,
		});
		return (
			(await createSignableGeneratedInstance(
				ctx,
				runtime,
				workItem,
				sourceBlueprintSnapshot
			)) ?? null
		);
	}

	await archiveRetryInstanceIfNeeded(ctx, workItem, {
		remediationAction: args?.remediationAction,
	});

	if (sourceBlueprintSnapshot.class === "private_static") {
		return (
			(await createStaticReferenceInstance(
				ctx,
				runtime,
				workItem,
				sourceBlueprintSnapshot
			)) ?? null
		);
	}

	if (sourceBlueprintSnapshot.class === "private_templated_non_signable") {
		return createNonSignableGeneratedInstance(
			ctx,
			runtime,
			workItem,
			sourceBlueprintSnapshot
		);
	}

	return null;
}

async function generateDealPackageWorkItem(
	ctx: DealPackageActionCtx,
	args: {
		remediationAction?: DealDocumentStoredRemediationAction;
		runtime: DealPackageRuntimeState;
		workItem: PackageWorkItem;
	}
): Promise<Id<"dealDocumentInstances"> | null> {
	return processPackageWorkItem(ctx, args.runtime, args.workItem, {
		remediationAction: args.remediationAction,
	});
}

async function prepareDealPackageRuntime(
	ctx: DealPackageActionCtx,
	args: DealPackageActionArgs
): Promise<DealPackagePreparation> {
	const snapshot = await ctx.runQuery(
		internal.documents.dealPackages.resolveDealParticipantSnapshotInternal,
		{
			dealId: args.dealId,
		}
	);
	const variables = buildDealVariableBag(snapshot);
	const signatories = buildSignatoryMappings(snapshot);
	const signatoryParticipants = buildSignatoryParticipants(snapshot);
	const existingPackage = await ctx.runQuery(
		internal.documents.dealPackages.getPackageByDealInternal,
		{
			dealId: args.dealId,
		}
	);
	const activeBlueprints =
		existingPackage?.blueprintSnapshots &&
		existingPackage.blueprintSnapshots.length > 0
			? []
			: await ctx.runQuery(
					internal.documents.dealPackages
						.listActivePackageBlueprintInputsInternal,
					{
						mortgageId: snapshot.mortgage._id,
					}
				);
	const activePackageBlueprintSnapshots =
		existingPackage?.blueprintSnapshots &&
		existingPackage.blueprintSnapshots.length > 0
			? []
			: await ctx.runQuery(
					internal.documents.dealPackages
						.listActiveDocumentPackageBlueprintSnapshotsInternal,
					{
						mortgageId: snapshot.mortgage._id,
					}
				);
	let blueprintSnapshots: DealPackageBlueprintSnapshot[];
	if (
		existingPackage?.blueprintSnapshots &&
		existingPackage.blueprintSnapshots.length > 0
	) {
		blueprintSnapshots = existingPackage.blueprintSnapshots;
	} else if (activePackageBlueprintSnapshots.length > 0) {
		blueprintSnapshots = activePackageBlueprintSnapshots;
	} else {
		blueprintSnapshots = activeBlueprints.map((blueprint: BlueprintRow) =>
			toDealPackageBlueprintSnapshot(blueprint)
		);
	}
	if (
		existingPackage?.status === "ready" &&
		!args.retry &&
		existingPackage.blueprintSnapshots &&
		existingPackage.blueprintSnapshots.length > 0
	) {
		return {
			result: buildCreateDocumentPackageResult({
				dealId: args.dealId,
				packageId: existingPackage._id,
				status: existingPackage.status,
			}),
		};
	}

	const packageId = await ctx.runMutation(
		internal.documents.dealPackages.ensurePackageHeaderInternal,
		{
			blueprintSnapshots,
			dealId: args.dealId,
			incrementRetryCount: Boolean(existingPackage),
			mortgageId: snapshot.mortgage._id,
			now: Date.now(),
		}
	);
	const existingInstances = await ctx.runQuery(
		internal.documents.dealPackages.listPackageInstancesInternal,
		{
			packageId,
		}
	);

	return {
		packageId,
		runtime: {
			dealId: args.dealId,
			dealStatus: snapshot.dealStatus,
			mortgageId: snapshot.mortgage._id,
			packageId,
			signatories,
			signatoryParticipants,
			variables,
		},
		workItems: buildPackageWorkItems({
			blueprintSnapshots,
			dealStatus: snapshot.dealStatus,
			existingInstances,
		}),
	};
}

async function buildRemediationRuntime(
	ctx: DealPackageActionCtx,
	args: {
		dealId: Id<"deals">;
		mortgageId: Id<"mortgages">;
		packageId: Id<"dealDocumentPackages">;
	}
): Promise<DealPackageRuntimeState> {
	const snapshot = await ctx.runQuery(
		internal.documents.dealPackages.resolveDealParticipantSnapshotInternal,
		{
			dealId: args.dealId,
		}
	);

	return {
		dealId: args.dealId,
		dealStatus: snapshot.dealStatus,
		mortgageId: args.mortgageId,
		packageId: args.packageId,
		signatories: buildSignatoryMappings(snapshot),
		signatoryParticipants: buildSignatoryParticipants(snapshot),
		variables: buildDealVariableBag(snapshot),
	};
}

async function finalizeDealPackage(
	ctx: DealPackageActionCtx,
	args: {
		dealId: Id<"deals">;
		packageId: Id<"dealDocumentPackages">;
	}
) {
	const finalRows = await ctx.runQuery(
		internal.documents.dealPackages.listPackageInstancesInternal,
		{ packageId: args.packageId }
	);
	const summary = summarizePackageStatus(finalRows);
	await ctx.runMutation(
		internal.documents.dealPackages.finalizePackageInternal,
		{
			lastError: summary.lastError,
			now: Date.now(),
			packageId: args.packageId,
			status: summary.status,
		}
	);

	return buildCreateDocumentPackageResult({
		dealId: args.dealId,
		packageId: args.packageId,
		status: summary.status,
	});
}

async function createDocumentPackageForDeal(
	ctx: DealPackageActionCtx,
	args: DealPackageActionArgs
): Promise<CreateDocumentPackageResult> {
	const preparation = await prepareDealPackageRuntime(ctx, args);
	if ("result" in preparation) {
		return preparation.result;
	}

	for (const workItem of preparation.workItems) {
		await generateDealPackageWorkItem(ctx, {
			runtime: preparation.runtime,
			workItem,
		});
	}

	return finalizeDealPackage(ctx, {
		dealId: args.dealId,
		packageId: preparation.packageId,
	});
}

const retryPackageGenerationAction = adminAction.use(
	requirePermissionAction("deal:manage")
);
const remediationMutation = adminMutation.use(requirePermission("deal:manage"));
const remediationAction = adminAction.use(
	requirePermissionAction("deal:manage")
);

function normalizeRemediationReason(reason: string) {
	const trimmed = reason.trim();
	if (trimmed.length < 3 || trimmed.length > 280) {
		throw new ConvexError("Reason must be between 3 and 280 characters");
	}
	return trimmed;
}

export const runCreateDocumentPackageInternal = convex
	.action()
	.input({
		dealId: v.id("deals"),
		retry: v.boolean(),
	})
	.handler(async (ctx, args): Promise<CreateDocumentPackageResult> => {
		return createDocumentPackageForDeal(ctx, args);
	})
	.internal();

export const retryPackageGeneration = retryPackageGenerationAction
	.input({
		dealId: v.id("deals"),
	})
	.handler(async (ctx, args) => {
		return createDocumentPackageForDeal(ctx, {
			dealId: args.dealId,
			retry: true,
		});
	})
	.public();

export const waiveDealDocumentInstance = remediationMutation
	.input({
		instanceId: v.id("dealDocumentInstances"),
		reason: v.string(),
	})
	.handler(async (ctx, args) => {
		const reason = normalizeRemediationReason(args.reason);
		const instance = await ctx.db.get(args.instanceId);
		if (!instance) {
			throw new ConvexError("Deal document instance not found");
		}
		const eligibility = getDealDocumentRemediationEligibility({
			archivedAt: instance.archivedAt ?? null,
			lastError: instance.lastError ?? null,
			remediationAction: instance.remediationAction ?? null,
			sourceBlueprintId: instance.sourceBlueprintId ?? null,
			sourceBlueprintSnapshot: instance.sourceBlueprintSnapshot,
			status: instance.status,
			supersededByInstanceId: instance.supersededByInstanceId ?? null,
		});
		if (eligibility !== "remediable_failed_instance") {
			throw new ConvexError("Deal document instance is not remediable");
		}

		const deal = await ctx.db.get(instance.dealId);
		if (!deal) {
			throw new ConvexError("Deal not found");
		}
		const now = Date.now();
		await ctx.db.patch(instance._id, {
			archivedAt: now,
			remediationAction: "waived_for_deal",
			remediationReason: reason,
			status: "archived",
			updatedAt: now,
		});
		await appendDealDocumentRemediationAudit(ctx, {
			action: "deal_document.waived_for_deal",
			afterState: {
				remediationAction: "waived_for_deal",
				remediationReason: reason,
				status: "archived",
			},
			deal,
			instance,
			previousState: instance.status,
			reason,
			timestamp: now,
		});

		const packageRows = await ctx.db
			.query("dealDocumentInstances")
			.withIndex("by_package", (query) =>
				query.eq("packageId", instance.packageId)
			)
			.collect();
		const summary = summarizePackageStatus(packageRows);
		await ctx.db.patch(instance.packageId, {
			lastError: summary.lastError,
			readyAt: summary.status === "ready" ? now : undefined,
			status: summary.status,
			updatedAt: now,
		});

		return { ok: true as const };
	})
	.public();

export const retryDealDocumentInstance = remediationAction
	.input({
		instanceId: v.id("dealDocumentInstances"),
	})
	.handler(
		async (ctx, args): Promise<DealDocumentInstanceRemediationResult> => {
			const target = await ctx.runQuery(
				internal.documents.dealPackages
					.getDealDocumentInstanceRemediationTargetInternal,
				{ instanceId: args.instanceId }
			);
			const runtime = await buildRemediationRuntime(ctx, {
				dealId: target.instance.dealId,
				mortgageId: target.instance.mortgageId,
				packageId: target.instance.packageId,
			});
			const claim = await ctx.runMutation(
				internal.documents.dealPackages
					.claimDealDocumentInstanceForRemediationInternal,
				{
					instanceId: target.instance._id,
					now: Date.now(),
					remediationAction: "retried_instance",
				}
			);
			const replacement = await generateDealPackageWorkItem(ctx, {
				remediationAction: "retried_instance",
				runtime,
				workItem: {
					instance: target.instance,
					type: "instance_retry",
				},
			});
			if (replacement) {
				await ctx.runMutation(
					internal.documents.dealPackages
						.patchDealDocumentInstanceSupersededByInternal,
					{
						instanceId: target.instance._id,
						now: Date.now(),
						supersededByInstanceId: replacement,
					}
				);
			}
			await finalizeDealPackage(ctx, {
				dealId: target.instance.dealId,
				packageId: target.instance.packageId,
			});
			await ctx.runMutation(
				internal.documents.dealPackages
					.appendDealDocumentRemediationAuditInternal,
				{
					action: "deal_document.retried_instance",
					afterState: {
						remediationAction: "retried_instance",
						status: "archived",
						supersededByInstanceId: replacement ? String(replacement) : null,
					},
					dealId: target.instance.dealId,
					instanceId: target.instance._id,
					previousState: claim.previousStatus,
					timestamp: Date.now(),
				}
			);

			return {
				ok: true as const,
				replacementInstanceId: replacement,
			};
		}
	)
	.public();

export const refreshDealDocumentInstanceSnapshot = remediationAction
	.input({
		instanceId: v.id("dealDocumentInstances"),
	})
	.handler(
		async (ctx, args): Promise<DealDocumentInstanceRemediationResult> => {
			const target = await ctx.runQuery(
				internal.documents.dealPackages
					.getDealDocumentInstanceRemediationTargetInternal,
				{ instanceId: args.instanceId }
			);
			const sourceBlueprintId = target.instance.sourceBlueprintId;
			if (!sourceBlueprintId) {
				throw new ConvexError("Deal document instance has no source blueprint");
			}
			const latestSnapshot = await ctx.runQuery(
				internal.documents.dealPackages
					.getLatestActiveSourceBlueprintSnapshotInternal,
				{ sourceBlueprintId }
			);
			const runtime = await buildRemediationRuntime(ctx, {
				dealId: target.instance.dealId,
				mortgageId: target.instance.mortgageId,
				packageId: target.instance.packageId,
			});
			const claim = await ctx.runMutation(
				internal.documents.dealPackages
					.claimDealDocumentInstanceForRemediationInternal,
				{
					instanceId: target.instance._id,
					now: Date.now(),
					remediationAction: "refreshed_from_source_snapshot",
				}
			);
			const replacement = await generateDealPackageWorkItem(ctx, {
				remediationAction: "refreshed_from_source_snapshot",
				runtime,
				workItem: {
					snapshot: latestSnapshot,
					type: "snapshot",
				},
			});
			if (replacement) {
				await ctx.runMutation(
					internal.documents.dealPackages
						.patchDealDocumentInstanceSupersededByInternal,
					{
						instanceId: target.instance._id,
						now: Date.now(),
						supersededByInstanceId: replacement,
					}
				);
			}
			await finalizeDealPackage(ctx, {
				dealId: target.instance.dealId,
				packageId: target.instance.packageId,
			});
			await ctx.runMutation(
				internal.documents.dealPackages
					.appendDealDocumentRemediationAuditInternal,
				{
					action: "deal_document.refreshed_from_source_snapshot",
					afterState: {
						remediationAction: "refreshed_from_source_snapshot",
						status: "archived",
						supersededByInstanceId: replacement ? String(replacement) : null,
					},
					dealId: target.instance.dealId,
					instanceId: target.instance._id,
					previousState: claim.previousStatus,
					timestamp: Date.now(),
				}
			);

			return {
				ok: true as const,
				replacementInstanceId: replacement,
			};
		}
	)
	.public();

export const archiveSourceBlueprintForFutureDeals = remediationMutation
	.input({
		instanceId: v.id("dealDocumentInstances"),
		reason: v.optional(v.string()),
		sourceBlueprintId: v.id("mortgageDocumentBlueprints"),
	})
	.handler(async (ctx, args) => {
		const instance = await ctx.db.get(args.instanceId);
		if (!instance) {
			throw new ConvexError("Deal document instance not found");
		}
		const eligibility = getDealDocumentRemediationEligibility({
			archivedAt: instance.archivedAt ?? null,
			lastError: instance.lastError ?? null,
			remediationAction: instance.remediationAction ?? null,
			sourceBlueprintId: instance.sourceBlueprintId ?? null,
			sourceBlueprintSnapshot: instance.sourceBlueprintSnapshot,
			status: instance.status,
			supersededByInstanceId: instance.supersededByInstanceId ?? null,
		});
		if (eligibility !== "remediable_failed_instance") {
			throw new ConvexError("Deal document instance is not remediable");
		}
		if (instance.sourceBlueprintId !== args.sourceBlueprintId) {
			throw new ConvexError(
				"Source blueprint does not match the failed document instance"
			);
		}

		const [blueprint, deal, packageRecord] = await Promise.all([
			ctx.db.get(args.sourceBlueprintId),
			ctx.db.get(instance.dealId),
			ctx.db.get(instance.packageId),
		]);
		if (!blueprint) {
			throw new ConvexError("Source blueprint not found");
		}
		if (!deal) {
			throw new ConvexError("Deal not found");
		}
		if (!packageRecord) {
			throw new ConvexError("Deal document package not found");
		}
		if (
			packageRecord.dealId !== instance.dealId ||
			packageRecord.mortgageId !== instance.mortgageId ||
			blueprint.mortgageId !== instance.mortgageId
		) {
			throw new ConvexError(
				"Failed document instance is not linked to the source blueprint context"
			);
		}

		const actorUser = await ctx.db
			.query("users")
			.withIndex("authId", (query) => query.eq("authId", ctx.viewer.authId))
			.unique();
		if (!actorUser) {
			throw new ConvexError("User not found in database");
		}

		const now = Date.now();
		if (blueprint.status !== "archived") {
			await ctx.db.patch(blueprint._id, {
				archivedAt: now,
				archivedByUserId: actorUser._id,
				status: "archived",
			});
		}
		await ctx.db.insert("auditJournal", {
			actorId: "system:deal-document-remediation",
			actorType: "system",
			afterState: {
				remediationAction: "archive_source_blueprint",
				sourceBlueprintId: String(blueprint._id),
				status: "archived",
			},
			beforeState: { status: blueprint.status },
			channel: "admin_dashboard",
			delta: {
				remediationAction: "archive_source_blueprint",
				sourceBlueprintId: String(blueprint._id),
				status: "archived",
			},
			entityId: String(deal._id),
			entityType: "deal",
			effectiveDate: businessDateFromTimestamp(now),
			eventCategory: "document_remediation",
			eventId: `deal_document.archived_source_blueprint:${String(
				blueprint._id
			)}:${now}`,
			eventType: "deal_document.archived_source_blueprint",
			legalEntityId: deal.orgId,
			linkedRecordIds: {
				dealDocumentInstanceId: String(instance._id),
				mortgageId: String(blueprint.mortgageId),
				packageId: String(instance.packageId),
				sourceBlueprintId: String(blueprint._id),
			},
			mortgageId: String(blueprint.mortgageId),
			newState: "archived",
			originSystem: "convex",
			organizationId: deal.orgId,
			outcome: "transitioned",
			payload: {
				reason: args.reason?.trim() || undefined,
				sourceBlueprintId: String(blueprint._id),
			},
			previousState: blueprint.status,
			reason: args.reason?.trim() || undefined,
			sequenceNumber: await nextAuditJournalSequenceNumber(ctx),
			timestamp: now,
		});

		return { ok: true as const };
	})
	.public();

export const listPublishedDealDocuments = documentQuery
	.input({})
	.handler(async (ctx) => {
		const instances = await ctx.db
			.query("dealDocumentInstances")
			.order("desc")
			.collect();
		const activeInstances = instances.filter(
			(instance) => instance.status !== "archived"
		);

		return await Promise.all(
			activeInstances.map(async (instance) => {
				const [packageRow, deal, mortgage, generatedDocument] =
					await Promise.all([
						ctx.db.get(instance.packageId),
						ctx.db.get(instance.dealId),
						ctx.db.get(instance.mortgageId),
						instance.generatedDocumentId
							? ctx.db.get(instance.generatedDocumentId)
							: Promise.resolve(null),
					]);
				const documentAsset = instance.assetId
					? await ctx.db.get(instance.assetId)
					: null;
				let documentUrl: string | null = null;
				if (generatedDocument?.pdfStorageId) {
					documentUrl = await ctx.storage.getUrl(
						generatedDocument.pdfStorageId
					);
				} else if (documentAsset?.fileRef) {
					documentUrl = await ctx.storage.getUrl(documentAsset.fileRef);
				}

				return {
					dealHref: `/admin/deals/${String(instance.dealId)}`,
					dealId: instance.dealId,
					dealStatus: deal?.status ?? null,
					displayName: instance.sourceBlueprintSnapshot.displayName,
					documentUrl,
					generatedDocumentId: instance.generatedDocumentId ?? null,
					instanceId: instance._id,
					mortgageId: mortgage?._id ?? instance.mortgageId,
					packageId: packageRow?._id ?? instance.packageId,
					packageStatus: packageRow?.status ?? null,
					signingStatus: generatedDocument?.signingStatus ?? null,
					status: instance.status,
					templateVersion:
						instance.sourceBlueprintSnapshot.templateVersion ?? null,
				};
			})
		);
	})
	.public();

export const getPortalDocumentPackage = dealQuery
	.input({
		dealId: v.id("deals"),
	})
	.handler(async (ctx, args) => {
		await assertDealAccess(ctx, args.dealId);

		const viewerUser = await getUserByAuthId(ctx, ctx.viewer.authId);
		return buildPackageSurface(ctx, args.dealId, {
			isFairLendAdmin: ctx.viewer.isFairLendAdmin,
			userId: viewerUser?._id,
		});
	})
	.public();

export async function readDealDocumentPackageSurface(
	ctx: Pick<QueryCtx, "db" | "storage">,
	dealId: Id<"deals">,
	viewer?: DealPackageViewerContext
) {
	return buildPackageSurface(ctx, dealId, viewer);
}
