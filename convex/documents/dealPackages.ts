import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx, QueryCtx } from "../_generated/server";
import { assertDealAccess } from "../authz/resourceAccess";
import {
	buildDealParticipantProjection,
	type DealParticipantProjection,
} from "../deals/participantProjection";
import {
	adminAction,
	convex,
	dealQuery,
	requirePermissionAction,
} from "../fluent";
import {
	type DealDocumentPackageStatus,
	type DealDocumentSourceBlueprintSnapshot,
	type DealPackageBlueprintSnapshot,
	dealDocumentInstanceKindValidator,
	dealDocumentInstanceStatusValidator,
	dealDocumentPackageStatusValidator,
	dealPackageBlueprintSnapshotValidator,
	mortgageDocumentBlueprintClassValidator,
} from "./contracts";
import { listMortgageBlueprintRows } from "./mortgageBlueprints";

type InstanceRow = Doc<"dealDocumentInstances">;
type BlueprintRow = Doc<"mortgageDocumentBlueprints">;

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
	latestValuationSnapshot: Doc<"mortgageValuationSnapshots"> | null;
	listing?: Doc<"listings"> | null;
	mortgage: Doc<"mortgages">;
	property: Doc<"properties">;
}

interface PackageSurface {
	instances: Array<{
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
		sourceBlueprintId: Id<"mortgageDocumentBlueprints"> | null;
		status: Doc<"dealDocumentInstances">["status"];
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

interface CreateDocumentPackageResult {
	dealId: Id<"deals">;
	packageId: Id<"dealDocumentPackages">;
	status: DealDocumentPackageStatus;
}

interface DealPackageActionCtx
	extends Pick<ActionCtx, "runAction" | "runMutation" | "runQuery"> {}

interface DealPackageActionArgs {
	dealId: Id<"deals">;
	retry: boolean;
}

interface DealPackageRuntimeState {
	dealId: Id<"deals">;
	mortgageId: Id<"mortgages">;
	packageId: Id<"dealDocumentPackages">;
	signatories: Array<{
		email: string;
		name: string;
		platformRole: string;
	}>;
	variables: Record<string, string>;
}

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

function toBlueprintSnapshot(
	blueprint: Pick<
		BlueprintRow,
		| "category"
		| "class"
		| "description"
		| "displayName"
		| "displayOrder"
		| "packageKey"
		| "packageLabel"
		| "templateId"
		| "templateVersion"
	>
): DealDocumentSourceBlueprintSnapshot {
	return {
		category: blueprint.category,
		class: blueprint.class,
		description: blueprint.description,
		displayName: blueprint.displayName,
		displayOrder: blueprint.displayOrder,
		packageKey: blueprint.packageKey,
		packageLabel: blueprint.packageLabel,
		templateId: blueprint.templateId,
		templateVersion: blueprint.templateVersion,
	};
}

function toPackageBlueprintSnapshot(
	blueprint: Pick<
		BlueprintRow,
		"_id" | "assetId" | "category" | "class" | "description" | "displayName"
	> &
		Pick<
			BlueprintRow,
			| "displayOrder"
			| "packageKey"
			| "packageLabel"
			| "templateId"
			| "templateVersion"
		>
): DealPackageBlueprintSnapshot {
	return {
		assetId: blueprint.assetId,
		sourceBlueprintId: blueprint._id,
		sourceBlueprintSnapshot: toBlueprintSnapshot(blueprint),
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

function buildDealVariableBag(snapshot: ParticipantSnapshot) {
	const lenderPrimary = projectionContact(snapshot.dealParticipants.buyer);
	const borrowerPrimary = projectionContact(snapshot.dealParticipants.seller);
	const lawyerPrimary = projectionContact(snapshot.dealParticipants.lawyer);
	const coBorrowers = snapshot.borrowers.filter(
		(borrower) => borrower.role === "co_borrower"
	);

	return {
		assigned_broker_email: snapshot.assignedBroker?.email ?? "",
		assigned_broker_full_name: snapshot.assignedBroker?.fullName ?? "",
		borrower_co_1_email: coBorrowers[0]?.email ?? "",
		borrower_co_1_full_name: coBorrowers[0]?.fullName ?? "",
		borrower_co_2_email: coBorrowers[1]?.email ?? "",
		borrower_co_2_full_name: coBorrowers[1]?.fullName ?? "",
		borrower_primary_email: borrowerPrimary?.email ?? "",
		borrower_primary_full_name: borrowerPrimary?.fullName ?? "",
		broker_of_record_email: snapshot.brokerOfRecord.email,
		broker_of_record_full_name: snapshot.brokerOfRecord.fullName,
		lawyer_primary_email: lawyerPrimary?.email ?? "",
		lawyer_primary_full_name: lawyerPrimary?.fullName ?? "",
		listing_description: snapshot.listing?.description ?? "",
		listing_marketplace_copy: snapshot.listing?.marketplaceCopy ?? "",
		listing_title: snapshot.listing?.title ?? "",
		lender_primary_email: lenderPrimary?.email ?? "",
		lender_primary_full_name: lenderPrimary?.fullName ?? "",
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
	};
}

function buildSignatoryMappings(snapshot: ParticipantSnapshot) {
	const lenderPrimary = projectionContact(snapshot.dealParticipants.buyer);
	const borrowerPrimary = projectionContact(snapshot.dealParticipants.seller);
	const lawyerPrimary = projectionContact(snapshot.dealParticipants.lawyer);
	const coBorrowers = snapshot.borrowers.filter(
		(borrower) => borrower.role === "co_borrower"
	);

	return [
		...(lenderPrimary
			? [
					{
						platformRole: "lender_primary",
						name: lenderPrimary.fullName,
						email: lenderPrimary.email,
					},
				]
			: []),
		...(borrowerPrimary
			? [
					{
						platformRole: "borrower_primary",
						name: borrowerPrimary.fullName,
						email: borrowerPrimary.email,
					},
				]
			: []),
		...(coBorrowers[0]
			? [
					{
						platformRole: "borrower_co_1",
						name: coBorrowers[0].fullName,
						email: coBorrowers[0].email,
					},
				]
			: []),
		...(coBorrowers[1]
			? [
					{
						platformRole: "borrower_co_2",
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
						platformRole: "lawyer_primary",
						name: lawyerPrimary.fullName,
						email: lawyerPrimary.email,
					},
				]
			: []),
	].filter(
		(entry) => entry.email.trim().length > 0 && entry.name.trim().length > 0
	);
}

async function buildPackageSurface(
	ctx: Pick<QueryCtx, "db" | "storage">,
	dealId: Id<"deals">
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
				if (row.assetId) {
					const asset = await ctx.db.get(row.assetId);
					url = asset ? await ctx.storage.getUrl(asset.fileRef) : null;
				} else if (row.generatedDocumentId) {
					const generatedDocument = await ctx.db.get(row.generatedDocumentId);
					url = generatedDocument
						? await ctx.storage.getUrl(generatedDocument.pdfStorageId)
						: null;
				}

				return {
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
					sourceBlueprintId: row.sourceBlueprintId ?? null,
					status: row.status,
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

function buildDownloadablePackageSurface(
	surface: PackageSurface
): PackageSurface {
	return {
		...surface,
		instances: surface.instances.filter(
			(instance) => instance.status === "available" && instance.url !== null
		),
	};
}

function summarizePackageStatus(
	rows: ReadonlyArray<
		Pick<InstanceRow, "lastError" | "status"> & {
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
	const managedRows = rows.filter(
		(row) => row.sourceBlueprintSnapshot.class !== "private_templated_signable"
	);
	const failedRows = managedRows.filter(
		(row) => row.status === "generation_failed"
	);
	const availableRows = managedRows.filter((row) => row.status === "available");

	if (failedRows.length === 0) {
		return { status: "ready" };
	}

	const lastError =
		failedRows.find((row) => row.lastError && row.lastError.length > 0)
			?.lastError ?? "Document package generation failed";

	if (availableRows.length > 0) {
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
		sourceBlueprintId: v.optional(v.id("mortgageDocumentBlueprints")),
		sourceBlueprintSnapshot: v.object({
			category: v.optional(v.string()),
			class: mortgageDocumentBlueprintClassValidator,
			description: v.optional(v.string()),
			displayName: v.string(),
			displayOrder: v.number(),
			packageKey: v.optional(v.string()),
			packageLabel: v.optional(v.string()),
			templateId: v.optional(v.id("documentTemplates")),
			templateVersion: v.optional(v.number()),
		}),
		status: dealDocumentInstanceStatusValidator,
		updatedAt: v.number(),
	})
	.handler(async (ctx, args) => {
		return ctx.db.insert("dealDocumentInstances", args);
	})
	.internal();

export const archiveDealDocumentInstance = convex
	.mutation()
	.input({
		instanceId: v.id("dealDocumentInstances"),
		now: v.number(),
	})
	.handler(async (ctx, args) => {
		const instance = await ctx.db.get(args.instanceId);
		if (!instance || instance.status === "archived") {
			return;
		}

		await ctx.db.patch(args.instanceId, {
			archivedAt: args.now,
			status: "archived",
			updatedAt: args.now,
		});
	})
	.internal();

export const insertGeneratedDocumentInternal = convex
	.mutation()
	.input({
		dealId: v.id("deals"),
		groupId: v.optional(v.id("documentTemplateGroups")),
		metadata: v.optional(v.any()),
		name: v.string(),
		pdfStorageId: v.id("_storage"),
		templateId: v.id("documentTemplates"),
		templateVersionUsed: v.number(),
	})
	.handler(async (ctx, args) => {
		return ctx.db.insert("generatedDocuments", {
			documensoEnvelopeId: undefined,
			entityId: String(args.dealId),
			entityType: "deal",
			generatedAt: Date.now(),
			generatedBy: "deal_document_package",
			groupId: args.groupId,
			metadata: args.metadata,
			name: args.name,
			pdfStorageId: args.pdfStorageId,
			sensitivityTier: "private",
			signingStatus: "not_applicable",
			templateId: args.templateId,
			templateVersionUsed: args.templateVersionUsed,
			updatedAt: Date.now(),
		});
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
	existingInstances: InstanceRow[];
}): PackageWorkItem[] {
	const retryItems = args.existingInstances
		.filter((instance) => instance.status === "generation_failed")
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
	workItem: PackageWorkItem
) {
	if (workItem.type !== "instance_retry") {
		return;
	}

	await ctx.runMutation(
		internal.documents.dealPackages.archiveDealDocumentInstance,
		{
			instanceId: workItem.instance._id,
			now: Date.now(),
		}
	);
}

async function createSignablePlaceholderInstance(
	ctx: DealPackageActionCtx,
	runtime: DealPackageRuntimeState,
	workItem: PackageWorkItem,
	sourceBlueprintSnapshot: DealDocumentSourceBlueprintSnapshot
) {
	await createPackageInstance(ctx, {
		dealId: runtime.dealId,
		kind: "generated",
		mortgageId: runtime.mortgageId,
		packageId: runtime.packageId,
		sourceBlueprintId: getWorkItemSourceBlueprintId(workItem),
		sourceBlueprintSnapshot,
		status: "signature_pending_recipient_resolution",
	});
}

async function createStaticReferenceInstance(
	ctx: DealPackageActionCtx,
	runtime: DealPackageRuntimeState,
	workItem: PackageWorkItem,
	sourceBlueprintSnapshot: DealDocumentSourceBlueprintSnapshot
) {
	const assetId = getWorkItemAssetId(workItem);
	if (!assetId) {
		await createPackageInstance(ctx, {
			dealId: runtime.dealId,
			kind: "static_reference",
			lastError: "Static blueprint is missing its source asset",
			mortgageId: runtime.mortgageId,
			packageId: runtime.packageId,
			sourceBlueprintId: getWorkItemSourceBlueprintId(workItem),
			sourceBlueprintSnapshot,
			status: "generation_failed",
		});
		return;
	}

	const asset = await ctx.runQuery(
		internal.documents.dealPackages.getDocumentAssetInternal,
		{
			assetId,
		}
	);
	if (!asset) {
		await createPackageInstance(ctx, {
			dealId: runtime.dealId,
			kind: "static_reference",
			lastError: "Static blueprint source asset record not found",
			mortgageId: runtime.mortgageId,
			packageId: runtime.packageId,
			sourceBlueprintId: getWorkItemSourceBlueprintId(workItem),
			sourceBlueprintSnapshot,
			status: "generation_failed",
		});
		return;
	}

	await createPackageInstance(ctx, {
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

async function createGeneratedFailureInstance(
	ctx: DealPackageActionCtx,
	runtime: DealPackageRuntimeState,
	workItem: PackageWorkItem,
	sourceBlueprintSnapshot: DealDocumentSourceBlueprintSnapshot,
	message: string
) {
	await createPackageInstance(ctx, {
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

	const generatedDocumentId = await ctx.runMutation(
		internal.documents.dealPackages.insertGeneratedDocumentInternal,
		{
			dealId: runtime.dealId,
			groupId: undefined,
			metadata: buildGeneratedDocumentMetadata({
				packageId: runtime.packageId,
				sourceBlueprintId: getWorkItemSourceBlueprintId(workItem),
			}),
			name: sourceBlueprintSnapshot.displayName,
			pdfStorageId: args.pdfRef,
			templateId: sourceBlueprintSnapshot.templateId,
			templateVersionUsed:
				sourceBlueprintSnapshot.templateVersion ?? args.templateVersionUsed,
		}
	);

	await createPackageInstance(ctx, {
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

async function createNonSignableGeneratedInstance(
	ctx: DealPackageActionCtx,
	runtime: DealPackageRuntimeState,
	workItem: PackageWorkItem,
	sourceBlueprintSnapshot: DealDocumentSourceBlueprintSnapshot
) {
	if (!sourceBlueprintSnapshot.templateId) {
		await createGeneratedFailureInstance(
			ctx,
			runtime,
			workItem,
			sourceBlueprintSnapshot,
			"Generated package instance is missing a templateId"
		);
		return;
	}

	try {
		const generationResult = await ctx.runAction(
			internal.documentEngine.generation.generateSingleTemplate,
			{
				pinnedVersion: sourceBlueprintSnapshot.templateVersion ?? undefined,
				signatoryMapping: runtime.signatories,
				templateId: sourceBlueprintSnapshot.templateId,
				variables: runtime.variables,
			}
		);

		if (!(generationResult.success && generationResult.pdfRef)) {
			await createGeneratedFailureInstance(
				ctx,
				runtime,
				workItem,
				sourceBlueprintSnapshot,
				buildTemplateGenerationFailureMessage({
					missingVariables: generationResult.missingVariables,
				})
			);
			return;
		}

		await createGeneratedSuccessInstance(
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
		await createGeneratedFailureInstance(
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
	workItem: PackageWorkItem
) {
	await archiveRetryInstanceIfNeeded(ctx, workItem);

	const sourceBlueprintSnapshot = getWorkItemSourceBlueprintSnapshot(workItem);
	if (sourceBlueprintSnapshot.class === "private_templated_signable") {
		await createSignablePlaceholderInstance(
			ctx,
			runtime,
			workItem,
			sourceBlueprintSnapshot
		);
		return;
	}

	if (sourceBlueprintSnapshot.class === "private_static") {
		await createStaticReferenceInstance(
			ctx,
			runtime,
			workItem,
			sourceBlueprintSnapshot
		);
		return;
	}

	if (sourceBlueprintSnapshot.class === "private_templated_non_signable") {
		await createNonSignableGeneratedInstance(
			ctx,
			runtime,
			workItem,
			sourceBlueprintSnapshot
		);
	}
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
	const variables = await ctx.runQuery(
		internal.documents.dealPackages.resolveDealDocumentVariablesInternal,
		{
			dealId: args.dealId,
		}
	);
	const signatories = await ctx.runQuery(
		internal.documents.dealPackages.resolveDealDocumentSignatoriesInternal,
		{
			dealId: args.dealId,
		}
	);
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
	const blueprintSnapshots =
		existingPackage?.blueprintSnapshots &&
		existingPackage.blueprintSnapshots.length > 0
			? existingPackage.blueprintSnapshots
			: activeBlueprints.map((blueprint: BlueprintRow) =>
					toPackageBlueprintSnapshot(blueprint)
				);
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
			mortgageId: snapshot.mortgage._id,
			packageId,
			signatories,
			variables,
		},
		workItems: buildPackageWorkItems({
			blueprintSnapshots,
			existingInstances,
		}),
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
		await processPackageWorkItem(ctx, preparation.runtime, workItem);
	}

	return finalizeDealPackage(ctx, {
		dealId: args.dealId,
		packageId: preparation.packageId,
	});
}

const retryPackageGenerationAction = adminAction.use(
	requirePermissionAction("deal:manage")
);

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

export const getPortalDocumentPackage = dealQuery
	.input({
		dealId: v.id("deals"),
	})
	.handler(async (ctx, args) => {
		await assertDealAccess(ctx, args.dealId);

		return buildDownloadablePackageSurface(
			await buildPackageSurface(ctx, args.dealId)
		);
	})
	.public();

export async function readDealDocumentPackageSurface(
	ctx: Pick<QueryCtx, "db" | "storage">,
	dealId: Id<"deals">
) {
	return buildPackageSurface(ctx, dealId);
}
