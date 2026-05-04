import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
	buildVelocityMortgageWorkflowSourceKey,
	VELOCITY_CREATION_SOURCE,
	VELOCITY_ORIGINATION_PATH,
	VELOCITY_WORKFLOW_SOURCE_TYPE,
} from "./constants";
import type {
	VelocityActivationHandoffV1,
	VelocityFairLendEnrichmentV1,
	VelocityMortgagePropertyType,
} from "./contracts";

type VelocityWorkspace = Doc<"velocityPackageWorkspaces">;
type VelocitySnapshot = Doc<"velocityPackageSnapshots">;

function requireValue<T>(
	value: T | null | undefined,
	message: string
): Exclude<T, null | undefined> {
	if (value === null || value === undefined || value === "") {
		throw new ConvexError(message);
	}
	return value as Exclude<T, null | undefined>;
}

function buildStreetAddress(
	property: VelocityWorkspace["normalizedCore"]["subjectProperty"]
) {
	return [property.streetNumber, property.streetName].filter(Boolean).join(" ");
}

function mapPropertyType(
	raw: string | null | undefined
): VelocityMortgagePropertyType {
	const normalized = raw?.trim().toLowerCase();
	if (normalized === "residential") {
		return "residential";
	}
	if (normalized === "commercial") {
		return "commercial";
	}
	if (normalized === "condo" || normalized === "condominium") {
		return "condo";
	}
	if (
		normalized === "multi_unit" ||
		normalized === "multi-unit" ||
		normalized === "multi unit"
	) {
		return "multi_unit";
	}
	if (normalized) {
		throw new ConvexError(`Unsupported Velocity property type: ${raw}`);
	}
	return "residential";
}

function mapListingOverrides(
	listingOverrides: VelocityFairLendEnrichmentV1["listingOverrides"]
): VelocityFairLendEnrichmentV1["listingOverrides"] {
	if (!listingOverrides) {
		return undefined;
	}
	return {
		...listingOverrides,
		heroImages: listingOverrides.heroImages?.map((image) => ({
			...image,
			storageId: image.storageId as Id<"_storage">,
		})),
	};
}

export function buildVelocityActivationHandoff(args: {
	activationAttemptId: Id<"velocityActivationAttempts">;
	actorAuthId: string;
	actorType: "admin" | "member";
	assignedBrokerId?: Id<"brokers">;
	bankAccountId?: Id<"bankAccounts">;
	borrowerLinks: VelocityActivationHandoffV1["borrowerLinks"];
	brokerOfRecordId: Id<"brokers">;
	reviewedSnapshot: VelocitySnapshot;
	viewerUserId: Id<"users">;
	workspace: VelocityWorkspace;
}): VelocityActivationHandoffV1 {
	if (args.reviewedSnapshot.workspaceId !== args.workspace._id) {
		throw new ConvexError(
			"Reviewed Velocity snapshot does not belong to the activation workspace."
		);
	}
	if (
		args.reviewedSnapshot.normalizedCoreHash !==
		args.workspace.finalReview?.reviewedSnapshotHash
	) {
		throw new ConvexError(
			"Reviewed Velocity snapshot hash does not match workspace final review."
		);
	}

	const core = args.reviewedSnapshot.normalizedCore;
	const mortgage = core.mortgageRequest;
	const property = core.subjectProperty;
	const remediation = args.workspace.fairlendEnrichment.activationRemediation;
	const padEvidence = args.workspace.fairlendEnrichment.padEvidence;
	const workflowSourceKey = buildVelocityMortgageWorkflowSourceKey(
		args.workspace.linkApplicationId
	);
	const termStartDate = requireValue(
		core.upstream.closingDate ?? mortgage.interestAdjustmentDate,
		"Velocity activation requires a term start date from the reviewed package."
	);

	return {
		activationAttemptId: args.activationAttemptId,
		actorAuthId: args.actorAuthId,
		actorType: args.actorType,
		assignedBrokerId:
			args.assignedBrokerId ?? remediation?.assignedBrokerId ?? undefined,
		borrowerLinks: args.borrowerLinks,
		brokerOfRecordId: args.brokerOfRecordId,
		collectionsDraft: {
			activationStatus: "pending",
			mode: "provider_managed_now",
			padAuthorizationAssetId: requireValue(
				padEvidence?.documentAssetId,
				"Velocity activation requires uploaded PAD evidence."
			),
			padAuthorizationSource: "uploaded",
			providerCode: "pad_rotessa",
			selectedBankAccountId: args.bankAccountId,
		},
		listingOverrides: mapListingOverrides(
			args.workspace.fairlendEnrichment.listingOverrides
		),
		mortgageDraft: {
			amortizationMonths: requireValue(
				mortgage.amortizationMonths ?? mortgage.amortization,
				"Velocity activation requires amortization months."
			),
			firstPaymentDate: requireValue(
				mortgage.firstPaymentDate,
				"Velocity activation requires first payment date."
			),
			interestAdjustmentDate: requireValue(
				mortgage.interestAdjustmentDate,
				"Velocity activation requires interest adjustment date."
			),
			interestRate: requireValue(
				mortgage.rate ?? mortgage.netRate,
				"Velocity activation requires interest rate."
			),
			lienPosition: requireValue(
				remediation?.lienPosition,
				"Velocity activation requires package-owned lien position."
			),
			loanType: requireValue(
				remediation?.loanType,
				"Velocity activation requires package-owned loan type."
			),
			maturityDate: requireValue(
				mortgage.maturityDate,
				"Velocity activation requires maturity date."
			),
			paymentAmount: requireValue(
				mortgage.paymentAmount,
				"Velocity activation requires payment amount."
			),
			paymentFrequency: requireValue(
				mortgage.fairlendPaymentFrequency,
				"Velocity activation requires supported payment frequency."
			),
			principal: requireValue(
				mortgage.requestedPrincipal,
				"Velocity activation requires principal."
			),
			rateType: requireValue(
				mortgage.fairlendRateType,
				"Velocity activation requires rate type."
			),
			termMonths: requireValue(
				mortgage.termInMonths,
				"Velocity activation requires term months."
			),
			termStartDate,
		},
		orgId: args.workspace.orgId,
		propertyDraft: {
			create: {
				city: requireValue(
					property.city,
					"Velocity activation requires property city."
				),
				postalCode: requireValue(
					property.postalCode,
					"Velocity activation requires property postal code."
				),
				propertyType: mapPropertyType(property.propertyTypeRaw),
				province: requireValue(
					property.province,
					"Velocity activation requires property province."
				),
				streetAddress: requireValue(
					buildStreetAddress(property),
					"Velocity activation requires property street address."
				),
				unit: property.unit ?? undefined,
			},
		},
		reviewedSnapshotHash: args.reviewedSnapshot.normalizedCoreHash,
		reviewedSnapshotId: args.reviewedSnapshot._id,
		source: {
			creationSource: VELOCITY_CREATION_SOURCE,
			originatedByUserId: String(args.viewerUserId),
			originatingWorkflowId: String(args.workspace._id),
			originatingWorkflowType: VELOCITY_WORKFLOW_SOURCE_TYPE,
			originationPath: VELOCITY_ORIGINATION_PATH,
			workflowSourceId: String(args.workspace._id),
			workflowSourceKey,
			workflowSourceType: VELOCITY_WORKFLOW_SOURCE_TYPE,
		},
		valuationDraft: args.workspace.fairlendEnrichment.valuation,
		viewerUserId: args.viewerUserId,
	};
}
