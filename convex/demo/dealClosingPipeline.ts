import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { dealDocumentPackageStatusValidator } from "../documents/contracts";
import { isDealStatusOpenForEmbeddedSigning } from "../documents/signature/gates";
import {
	getSignatureProvider,
	type SignatureProviderCleanupEnvelopeResult,
} from "../documents/signature/provider";
import { appendAuditJournalEntry } from "../engine/auditJournal";
import { executeTransition } from "../engine/transition";
import { authedAction, authedQuery, convex, type Viewer } from "../fluent";

const DEMO_PACKAGE_DEFINITION_ID =
	"rd7t376j110ynd5gnvtnskhzch85vnen" as Id<"documentPackageDefinitions">;
const DEMO_PACKAGE_TITLE = "test full package april30";
const DEMO_ACTOR_ID = "demo-deal-closing-pipeline";
const DEMO_ORG_ID = "org_01KKF56VABM4NYFFSR039RTJBM";
const DEMO_LENDER = {
	userId: "k57ed93m3d2w0h2n3q0h8447hd81p79k" as Id<"users">,
	authId: "user_01KJ6BJXS10933HSV7KYJ9HXMN",
	email: "connor.belez@gmail.com",
	name: "Connor Belez",
};
const DEMO_BORROWER = {
	authId: "user_demo_deal_borrower",
	email: "borrower.demo-deal@test.fairlend.ca",
	firstName: "Bailey",
	lastName: "Borrower",
};
const DEMO_LAWYER = {
	authId: "user_demo_deal_lawyer",
	email: "lawyer.demo-deal@test.fairlend.ca",
	firstName: "Layla",
	lastName: "Lawyer",
};

type DemoPackageDefinition = Pick<
	Doc<"documentPackageDefinitions">,
	"_id" | "currentPublishedVersion" | "name"
>;
type DemoPackageVersion = Pick<Doc<"documentPackageVersions">, "_id">;
type DemoAuditMetadata = Record<string, string | number | boolean | null>;
interface DemoAuditEvent {
	actorId: string;
	channel: Doc<"auditJournal">["channel"];
	eventType: string;
	id: Id<"auditJournal"> | Id<"dealEnvelopeProviderEvents">;
	message: string;
	metadata: DemoAuditMetadata;
	newState: string | null;
	previousState: string | null;
	timestamp: number;
}
interface DemoDealGraph {
	deal: Doc<"deals">;
	lender: Doc<"lenders">;
	mortgage: Doc<"mortgages">;
	property: Doc<"properties">;
	user: Doc<"users">;
}

export type FixedPackageLookup =
	| { status: "missing_package" }
	| {
			status: "missing_published_version";
			definition: DemoPackageDefinition;
	  }
	| {
			status: "ready";
			definition: DemoPackageDefinition;
			version: DemoPackageVersion;
	  };

type DemoSetupStatus =
	| "missing_package"
	| "missing_published_version"
	| "ready";

type DemoPackageGenerationStatus =
	| Doc<"dealDocumentPackages">["status"]
	| "generation_failed";

type DemoResetStatus =
	| "demo_package_generation_succeeded"
	| "demo_package_generation_failed";
type DemoApprovalStatus =
	| "demo_admin_approval_gate_approved"
	| "demo_admin_approval_gate_already_open";
type DemoApprovalStartState =
	| "initiated"
	| "lawyerOnboarding.pending"
	| "lawyerOnboarding.verified";

interface DemoApprovalResult {
	dealId: Id<"deals">;
	mortgageId: Id<"mortgages">;
	newState: string;
	ok: true;
	packageGeneration: DemoGenerationResult | null;
	previousState: string;
	status: DemoApprovalStatus;
}

interface DemoSignableEnvelopeRecipient {
	providerRecipientId: string | null;
	signingOrder: number;
	status: "declined" | "opened" | "pending" | "signed";
}

interface DemoSignableEnvelopeDocument {
	dealId: Id<"deals">;
	dealStatus: string | null;
	envelope: {
		providerCode: "documenso";
		providerEnvelopeId: string;
		status:
			| "completed"
			| "declined"
			| "draft"
			| "partially_signed"
			| "provider_error"
			| "sent"
			| "voided";
	};
	recipients: DemoSignableEnvelopeRecipient[];
}

function canStartDemoAdminApproval(
	state: string
): state is DemoApprovalStartState {
	return (
		state === "initiated" ||
		state === "lawyerOnboarding.pending" ||
		state === "lawyerOnboarding.verified"
	);
}

function findNextDemoSigningRecipient(
	document: DemoSignableEnvelopeDocument
): DemoSignableEnvelopeRecipient | null {
	const orderedRecipients = [...document.recipients].sort(
		(left, right) => left.signingOrder - right.signingOrder
	);

	return (
		orderedRecipients.find((recipient) => {
			if (
				!recipient.providerRecipientId ||
				recipient.status === "signed" ||
				recipient.status === "declined"
			) {
				return false;
			}

			return !orderedRecipients.some(
				(previousRecipient) =>
					previousRecipient.signingOrder < recipient.signingOrder &&
					previousRecipient.status !== "signed"
			);
		}) ?? null
	);
}

const signatureProviderCleanupStatusValidator = v.union(
	v.literal("deleted"),
	v.literal("not_deletable"),
	v.literal("provider_error")
);

type DemoGenerationResult =
	| {
			error: null;
			packageId: Id<"dealDocumentPackages">;
			status: "ready";
	  }
	| {
			error: string;
			packageId: Id<"dealDocumentPackages"> | null;
			status: Exclude<DemoPackageGenerationStatus, "ready">;
	  };

const demoGenerationStatusValidator = v.union(
	dealDocumentPackageStatusValidator,
	v.literal("generation_failed")
);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorToMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function isProviderNotDeletableError(error: unknown): boolean {
	if (!isRecord(error)) {
		return false;
	}

	const status = error.status;
	return typeof status === "number" && status >= 400 && status < 500;
}

function toCleanedSigningStatus(
	status: SignatureProviderCleanupEnvelopeResult["status"]
): "provider_error" | "voided" {
	return status === "deleted" ? "voided" : "provider_error";
}

function normalizeAuditMetadata(value: unknown): DemoAuditMetadata {
	if (!isRecord(value)) {
		return {};
	}

	return Object.fromEntries(
		Object.entries(value).filter(
			(entry): entry is [string, string | number | boolean | null] => {
				const entryValue = entry[1];
				return (
					entryValue === null ||
					typeof entryValue === "string" ||
					typeof entryValue === "number" ||
					typeof entryValue === "boolean"
				);
			}
		)
	);
}

function readAuditPayload(payload: unknown): {
	message: string | null;
	metadata: DemoAuditMetadata;
} {
	if (!isRecord(payload)) {
		return { message: null, metadata: {} };
	}

	return {
		message: typeof payload.message === "string" ? payload.message : null,
		metadata: normalizeAuditMetadata(payload.metadata),
	};
}

export async function cleanupDemoDocumensoEnvelope(
	providerEnvelopeId: string
): Promise<SignatureProviderCleanupEnvelopeResult> {
	try {
		const provider = getSignatureProvider("documenso", {
			fetchFn: fetch,
			getStorageBlob: async () => null,
		});
		await provider.deleteEnvelope({ providerEnvelopeId });
		return {
			providerEnvelopeId,
			status: "deleted",
		};
	} catch (error) {
		return {
			error: errorToMessage(error),
			providerEnvelopeId,
			status: isProviderNotDeletableError(error)
				? "not_deletable"
				: "provider_error",
		};
	}
}

function isDemoMortgage(mortgage: Doc<"mortgages">): boolean {
	return (
		mortgage.workflowSourceKey === "demo_deal_closing_pipeline" ||
		mortgage.creationSource === "demo_deal_closing_pipeline" ||
		mortgage.originatedByUserId === DEMO_ACTOR_ID
	);
}

export function buildDemoGenerationResult(args: {
	generationResult: {
		packageId: Id<"dealDocumentPackages">;
		status: Exclude<DemoPackageGenerationStatus, "generation_failed">;
	};
	packageRow: { lastError?: string | null } | null;
}): DemoGenerationResult {
	if (args.generationResult.status === "ready") {
		return {
			error: null,
			packageId: args.generationResult.packageId,
			status: "ready",
		};
	}

	return {
		error:
			args.packageRow?.lastError ??
			`Document package generation ended with status "${args.generationResult.status}".`,
		packageId: args.generationResult.packageId,
		status: args.generationResult.status,
	};
}

function projectDemoPackageDefinition(
	definition: Doc<"documentPackageDefinitions">
): DemoPackageDefinition {
	return {
		_id: definition._id,
		currentPublishedVersion: definition.currentPublishedVersion,
		name: definition.name,
	};
}

function projectDemoPackageVersion(
	version: Doc<"documentPackageVersions">
): DemoPackageVersion {
	return {
		_id: version._id,
	};
}

async function lookupPackageByIdAndTitle(
	ctx: Pick<QueryCtx, "db">,
	args: {
		packageDefinitionId: Id<"documentPackageDefinitions">;
		expectedTitle: string;
	}
): Promise<FixedPackageLookup> {
	const definition = await ctx.db.get(args.packageDefinitionId);
	if (!definition || definition.name !== args.expectedTitle) {
		return {
			status: "missing_package",
		};
	}

	const version = await lookupCurrentPackageVersion(ctx, definition);
	if (!version) {
		return {
			status: "missing_published_version",
			definition: projectDemoPackageDefinition(definition),
		};
	}

	return {
		status: "ready",
		definition: projectDemoPackageDefinition(definition),
		version,
	};
}

async function lookupCurrentPackageVersion(
	ctx: Pick<QueryCtx, "db">,
	definition: Doc<"documentPackageDefinitions">
): Promise<DemoPackageVersion | null> {
	const currentPublishedVersion = definition.currentPublishedVersion;
	if (currentPublishedVersion === undefined) {
		return null;
	}

	const version = await ctx.db
		.query("documentPackageVersions")
		.withIndex("by_package", (query) =>
			query
				.eq("packageId", definition._id)
				.eq("version", currentPublishedVersion)
		)
		.unique();
	if (!version) {
		return null;
	}

	return projectDemoPackageVersion(version);
}

async function lookupFixedPackage(
	ctx: Pick<QueryCtx, "db">
): Promise<FixedPackageLookup> {
	return await lookupPackageByIdAndTitle(ctx, {
		packageDefinitionId: DEMO_PACKAGE_DEFINITION_ID,
		expectedTitle: DEMO_PACKAGE_TITLE,
	});
}

async function ensureActivePackageApplication(
	ctx: Pick<MutationCtx, "db">,
	args: {
		mortgageId: Id<"mortgages">;
		packageVersionId: Id<"documentPackageVersions">;
		userId?: Id<"users">;
	}
) {
	const activeApplications = await ctx.db
		.query("mortgagePackageApplications")
		.withIndex("by_mortgage_status", (query) =>
			query.eq("mortgageId", args.mortgageId).eq("status", "active")
		)
		.collect();
	const matchingApplication = activeApplications.find(
		(application) => application.packageVersionId === args.packageVersionId
	);
	const now = Date.now();
	for (const application of activeApplications) {
		if (application._id !== matchingApplication?._id) {
			await ctx.db.patch(application._id, {
				archivedAt: now,
				archivedByUserId: args.userId,
				status: "archived",
			});
		}
	}

	if (matchingApplication) {
		return matchingApplication._id;
	}

	return await ctx.db.insert("mortgagePackageApplications", {
		createdAt: now,
		createdByUserId: args.userId,
		mortgageId: args.mortgageId,
		packageVersionId: args.packageVersionId,
		status: "active",
	});
}

function buildPackageDefinitionSurface(lookup: FixedPackageLookup) {
	const definition =
		lookup.status === "missing_package" ? null : lookup.definition;

	return {
		id: DEMO_PACKAGE_DEFINITION_ID,
		expectedTitle: DEMO_PACKAGE_TITLE,
		name: definition?.name ?? null,
		currentPublishedVersion: definition?.currentPublishedVersion ?? null,
	};
}

async function findFixedDemoUser(
	ctx: Pick<QueryCtx, "db">
): Promise<Doc<"users"> | null> {
	const userByAuthId = await ctx.db
		.query("users")
		.withIndex("authId", (query) => query.eq("authId", DEMO_LENDER.authId))
		.first();
	if (userByAuthId) {
		return userByAuthId;
	}

	return await ctx.db
		.query("users")
		.withIndex("by_email", (query) => query.eq("email", DEMO_LENDER.email))
		.first();
}

async function ensureFixedDemoUser(ctx: MutationCtx): Promise<Doc<"users">> {
	const existing = await findFixedDemoUser(ctx);
	if (existing) {
		const patch: Partial<Doc<"users">> = {};
		if (existing.authId !== DEMO_LENDER.authId) {
			patch.authId = DEMO_LENDER.authId;
		}
		if (existing.email !== DEMO_LENDER.email) {
			patch.email = DEMO_LENDER.email;
		}
		if (existing.firstName !== "Connor") {
			patch.firstName = "Connor";
		}
		if (existing.lastName !== "Belez") {
			patch.lastName = "Belez";
		}
		if (Object.keys(patch).length > 0) {
			await ctx.db.patch(existing._id, patch);
			const updated = await ctx.db.get(existing._id);
			if (!updated) {
				throw new Error("Fixed demo user disappeared during update");
			}
			return updated;
		}
		return existing;
	}

	const userId = await ctx.db.insert("users", {
		authId: DEMO_LENDER.authId,
		email: DEMO_LENDER.email,
		firstName: "Connor",
		lastName: "Belez",
	});
	const user = await ctx.db.get(userId);
	if (!user) {
		throw new Error("Failed to create fixed demo user");
	}
	return user;
}

async function ensureDemoUserByAuth(
	ctx: MutationCtx,
	user: {
		authId: string;
		email: string;
		firstName: string;
		lastName: string;
	}
): Promise<Doc<"users">> {
	const existing = await ctx.db
		.query("users")
		.withIndex("authId", (query) => query.eq("authId", user.authId))
		.first();
	if (existing) {
		const patch: Partial<Doc<"users">> = {};
		if (existing.email !== user.email) {
			patch.email = user.email;
		}
		if (existing.firstName !== user.firstName) {
			patch.firstName = user.firstName;
		}
		if (existing.lastName !== user.lastName) {
			patch.lastName = user.lastName;
		}
		if (Object.keys(patch).length > 0) {
			await ctx.db.patch(existing._id, patch);
			const updated = await ctx.db.get(existing._id);
			if (!updated) {
				throw new Error("Demo user disappeared during update");
			}
			return updated;
		}
		return existing;
	}

	const userId = await ctx.db.insert("users", {
		authId: user.authId,
		email: user.email,
		firstName: user.firstName,
		lastName: user.lastName,
	});
	const created = await ctx.db.get(userId);
	if (!created) {
		throw new Error("Failed to create demo user");
	}
	return created;
}

async function findDemoDealGraph(
	ctx: Pick<QueryCtx, "db">
): Promise<DemoDealGraph | null> {
	const user = await findFixedDemoUser(ctx);
	if (!user) {
		return null;
	}

	const lender = await ctx.db
		.query("lenders")
		.withIndex("by_user", (query) => query.eq("userId", user._id))
		.first();
	if (!lender) {
		return null;
	}

	const deals = await ctx.db
		.query("deals")
		.withIndex("by_lender", (query) => query.eq("lenderId", lender._id))
		.collect();
	for (const deal of deals) {
		const mortgage = await ctx.db.get(deal.mortgageId);
		if (!mortgage) {
			continue;
		}
		const isDemoDeal =
			deal.createdBy === DEMO_ACTOR_ID || isDemoMortgage(mortgage);
		if (!isDemoDeal) {
			continue;
		}
		const property = await ctx.db.get(mortgage.propertyId);
		if (property) {
			return { deal, lender, mortgage, property, user };
		}
	}
	return null;
}

async function ensureDemoBroker(
	ctx: MutationCtx,
	userId: Id<"users">
): Promise<Id<"brokers">> {
	const existing = await ctx.db
		.query("brokers")
		.withIndex("by_user", (query) => query.eq("userId", userId))
		.first();
	if (existing) {
		return existing._id;
	}

	const now = Date.now();
	return await ctx.db.insert("brokers", {
		createdAt: now,
		lastTransitionAt: now,
		onboardedAt: now,
		orgId: DEMO_ORG_ID,
		status: "active",
		userId,
	});
}

async function ensureDemoLender(
	ctx: MutationCtx,
	userId: Id<"users">
): Promise<Doc<"lenders">> {
	const existing = await ctx.db
		.query("lenders")
		.withIndex("by_user", (query) => query.eq("userId", userId))
		.first();
	if (existing) {
		return existing;
	}

	const now = Date.now();
	const brokerId = await ensureDemoBroker(ctx, userId);
	const lenderId = await ctx.db.insert("lenders", {
		accreditationStatus: "accredited",
		activatedAt: now,
		brokerId,
		createdAt: now,
		onboardingEntryPath: "admin_direct",
		orgId: DEMO_ORG_ID,
		status: "active",
		userId,
	});
	const lender = await ctx.db.get(lenderId);
	if (!lender) {
		throw new Error("Failed to create fixed demo lender");
	}
	return lender;
}

async function ensureDemoBorrower(
	ctx: MutationCtx,
	userId: Id<"users">
): Promise<Doc<"borrowers">> {
	const existing = await ctx.db
		.query("borrowers")
		.withIndex("by_user", (query) => query.eq("userId", userId))
		.first();
	if (existing) {
		return existing;
	}

	const now = Date.now();
	const borrowerId = await ctx.db.insert("borrowers", {
		createdAt: now,
		creationSource: "demo_deal_closing_pipeline",
		lastTransitionAt: now,
		orgId: DEMO_ORG_ID,
		status: "active",
		userId,
		workflowSourceKey: "demo_deal_closing_pipeline",
	});
	const borrower = await ctx.db.get(borrowerId);
	if (!borrower) {
		throw new Error("Failed to create demo borrower");
	}
	return borrower;
}

async function ensureDemoDealAccess(
	ctx: MutationCtx,
	args: {
		dealId: Id<"deals">;
		role: Doc<"dealAccess">["role"];
		userId: string;
	}
) {
	const existing = await ctx.db
		.query("dealAccess")
		.withIndex("by_user_and_deal", (query) =>
			query.eq("userId", args.userId).eq("dealId", args.dealId)
		)
		.first();
	if (existing) {
		if (existing.role !== args.role || existing.status !== "active") {
			await ctx.db.patch(existing._id, {
				revokedAt: undefined,
				role: args.role,
				status: "active",
			});
		}
		return;
	}

	await ctx.db.insert("dealAccess", {
		dealId: args.dealId,
		grantedAt: Date.now(),
		grantedBy: DEMO_ACTOR_ID,
		role: args.role,
		status: "active",
		userId: args.userId,
	});
}

async function ensureDemoDealParticipants(
	ctx: MutationCtx,
	graph: DemoDealGraph
): Promise<DemoDealGraph> {
	const now = Date.now();
	const borrowerUser = await ensureDemoUserByAuth(ctx, DEMO_BORROWER);
	await ensureDemoUserByAuth(ctx, DEMO_LAWYER);
	const borrower = await ensureDemoBorrower(ctx, borrowerUser._id);

	const borrowerLinks = await ctx.db
		.query("mortgageBorrowers")
		.withIndex("by_mortgage", (query) =>
			query.eq("mortgageId", graph.mortgage._id)
		)
		.collect();
	if (!borrowerLinks.some((link) => link.borrowerId === borrower._id)) {
		await ctx.db.insert("mortgageBorrowers", {
			addedAt: now,
			borrowerId: borrower._id,
			mortgageId: graph.mortgage._id,
			role: "primary",
		});
	}

	const assignments = await ctx.db
		.query("closingTeamAssignments")
		.withIndex("by_mortgage", (query) =>
			query.eq("mortgageId", graph.mortgage._id)
		)
		.collect();
	if (
		!assignments.some(
			(assignment) =>
				assignment.role === "closing_lawyer" &&
				assignment.userId === DEMO_LAWYER.authId
		)
	) {
		await ctx.db.insert("closingTeamAssignments", {
			assignedAt: now,
			assignedBy: DEMO_ACTOR_ID,
			mortgageId: graph.mortgage._id,
			role: "closing_lawyer",
			userId: DEMO_LAWYER.authId,
		});
	}

	await ensureDemoDealAccess(ctx, {
		dealId: graph.deal._id,
		role: "borrower",
		userId: DEMO_BORROWER.authId,
	});
	await ensureDemoDealAccess(ctx, {
		dealId: graph.deal._id,
		role: "platform_lawyer",
		userId: DEMO_LAWYER.authId,
	});

	const dealPatch: Partial<Doc<"deals">> = {};
	if (graph.deal.sellerId !== DEMO_BORROWER.authId) {
		dealPatch.sellerId = DEMO_BORROWER.authId;
	}
	if (graph.deal.lawyerId !== DEMO_LAWYER.authId) {
		dealPatch.lawyerId = DEMO_LAWYER.authId;
	}
	if (graph.deal.lawyerType !== "platform_lawyer") {
		dealPatch.lawyerType = "platform_lawyer";
	}
	if (Object.keys(dealPatch).length > 0) {
		await ctx.db.patch(graph.deal._id, dealPatch);
	}
	const deal = await ctx.db.get(graph.deal._id);
	if (!deal) {
		throw new Error("Demo deal disappeared during participant setup");
	}
	return { ...graph, deal };
}

async function ensureDemoDealGraph(ctx: MutationCtx): Promise<DemoDealGraph> {
	const existing = await findDemoDealGraph(ctx);
	if (existing) {
		return await ensureDemoDealParticipants(ctx, existing);
	}

	const now = Date.now();
	const user = await ensureFixedDemoUser(ctx);
	const lender = await ensureDemoLender(ctx, user._id);
	const propertyId = await ctx.db.insert("properties", {
		city: "Toronto",
		createdAt: now,
		postalCode: "M5H 1J9",
		propertyType: "residential",
		province: "ON",
		streetAddress: "123 King St W",
		unit: "Suite 1201",
	});
	const mortgageId = await ctx.db.insert("mortgages", {
		amortizationMonths: 300,
		brokerOfRecordId: lender.brokerId,
		collectionExecutionMode: "app_owned",
		collectionExecutionUpdatedAt: now,
		createdAt: now,
		creationSource: "demo_deal_closing_pipeline",
		firstPaymentDate: "2026-06-01",
		interestAdjustmentDate: "2026-05-01",
		interestRate: 9.5,
		lienPosition: 1,
		loanType: "conventional",
		machineContext: { lastPaymentAt: 0, missedPayments: 0 },
		maturityDate: "2027-04-30",
		orgId: DEMO_ORG_ID,
		originationPath: "admin_direct",
		originatedByUserId: DEMO_ACTOR_ID,
		originatingWorkflowId: "demo_deal_closing_pipeline",
		originatingWorkflowType: "demo",
		paymentAmount: 2450,
		paymentBootstrapScheduleRuleMissing: false,
		paymentFrequency: "monthly",
		principal: 250_000,
		propertyId,
		rateType: "fixed",
		status: "active",
		termMonths: 12,
		termStartDate: "2026-05-01",
		workflowSourceKey: "demo_deal_closing_pipeline",
	});
	const dealId = await ctx.db.insert("deals", {
		buyerId: DEMO_LENDER.authId,
		closingDate: new Date("2026-05-15T12:00:00.000Z").getTime(),
		createdAt: now,
		createdBy: DEMO_ACTOR_ID,
		fractionalShare: 2500,
		lenderId: lender._id,
		mortgageId,
		orgId: DEMO_ORG_ID,
		sellerId: DEMO_BORROWER.authId,
		status: "initiated",
	});

	const mortgage = await ctx.db.get(mortgageId);
	const property = await ctx.db.get(propertyId);
	const deal = await ctx.db.get(dealId);
	if (!(mortgage && property && deal)) {
		throw new Error("Failed to create demo deal graph");
	}

	return await ensureDemoDealParticipants(ctx, {
		deal,
		lender,
		mortgage,
		property,
		user,
	});
}

async function appendDemoAuditEvent(
	ctx: MutationCtx,
	args: {
		dealId: Id<"deals">;
		eventType: string;
		message: string;
		metadata?: DemoAuditMetadata;
		mortgageId?: Id<"mortgages">;
		newState: string;
		previousState: string;
	}
): Promise<Id<"auditJournal">> {
	return await appendAuditJournalEntry(ctx, {
		actorId: DEMO_ACTOR_ID,
		actorType: "system",
		channel: "simulation",
		entityId: args.dealId,
		entityType: "deal",
		eventCategory: "demo_pipeline",
		eventType: args.eventType,
		linkedRecordIds: {
			entityId: args.dealId,
			mortgageId: args.mortgageId,
		},
		newState: args.newState,
		organizationId: DEMO_ORG_ID,
		outcome: "transitioned",
		payload: {
			message: args.message,
			metadata: args.metadata ?? {},
		},
		previousState: args.previousState,
		timestamp: Date.now(),
	});
}

async function listExistingDemoProviderEnvelopeIds(
	ctx: Pick<QueryCtx, "db">,
	dealId: Id<"deals">
): Promise<string[]> {
	const packageRows = await ctx.db
		.query("dealDocumentPackages")
		.withIndex("by_deal", (query) => query.eq("dealId", dealId))
		.collect();
	const packageIds = new Set(packageRows.map((packageRow) => packageRow._id));
	const providerEnvelopeIds = new Set<string>();

	const signatureEnvelopes = await ctx.db
		.query("signatureEnvelopes")
		.withIndex("by_deal", (query) => query.eq("dealId", dealId))
		.collect();
	for (const envelope of signatureEnvelopes) {
		if (envelope.providerCode === "documenso") {
			providerEnvelopeIds.add(envelope.providerEnvelopeId);
		}
	}

	for (const packageId of packageIds) {
		const attempts = await ctx.db
			.query("dealEnvelopeAttempts")
			.withIndex("by_package", (query) => query.eq("packageId", packageId))
			.collect();
		for (const attempt of attempts) {
			if (attempt.provider === "documenso" && attempt.providerEnvelopeId) {
				providerEnvelopeIds.add(attempt.providerEnvelopeId);
			}
		}

		const instances = await ctx.db
			.query("dealDocumentInstances")
			.withIndex("by_package", (query) => query.eq("packageId", packageId))
			.collect();
		for (const instance of instances) {
			if (!instance.generatedDocumentId) {
				continue;
			}
			const generatedDocument = await ctx.db.get(instance.generatedDocumentId);
			if (generatedDocument?.documensoEnvelopeId) {
				providerEnvelopeIds.add(generatedDocument.documensoEnvelopeId);
			}
		}
	}

	return [...providerEnvelopeIds].sort();
}

async function listDemoAuditEvents(
	ctx: Pick<QueryCtx, "db">,
	dealId: Id<"deals">
): Promise<DemoAuditEvent[]> {
	const events = await ctx.db
		.query("auditJournal")
		.withIndex("by_entity", (query) =>
			query.eq("entityType", "deal").eq("entityId", dealId)
		)
		.order("desc")
		.take(50);

	return events
		.filter(
			(event) =>
				event.channel === "simulation" &&
				event.eventCategory === "demo_pipeline"
		)
		.slice(0, 25)
		.map((event) => {
			const payload = readAuditPayload(event.payload);
			return {
				id: event._id,
				eventType: event.eventType,
				message: payload.message ?? event.eventType,
				actorId: event.actorId,
				channel: event.channel,
				timestamp: event.timestamp,
				metadata: payload.metadata,
				newState: event.newState ?? null,
				previousState: event.previousState ?? null,
			};
		});
}

async function listDocumensoProviderEvents(
	ctx: Pick<QueryCtx, "db">,
	dealId: Id<"deals">
): Promise<DemoAuditEvent[]> {
	const events = await ctx.db
		.query("dealEnvelopeProviderEvents")
		.withIndex("by_deal", (query) => query.eq("dealId", dealId))
		.order("desc")
		.take(50);

	return events
		.filter((event) => event.provider === "documenso")
		.slice(0, 25)
		.map((event) => ({
			id: event._id,
			eventType: `documenso_${event.normalizedEventType}`,
			message: `Documenso ${event.normalizedEventType}`,
			actorId: "documenso",
			channel: "api_webhook",
			timestamp: event.processedAt ?? event.receivedAt,
			metadata: {
				providerEnvelopeId: event.providerEnvelopeId ?? null,
				providerRecipientId: event.providerRecipientId ?? null,
				rawEventType: event.rawEventType,
				status: event.status,
			},
			newState: event.normalizedEventType,
			previousState: null,
		}));
}

async function listDemoAuditTrail(
	ctx: Pick<QueryCtx, "db">,
	dealId: Id<"deals">
): Promise<DemoAuditEvent[]> {
	const [demoEvents, providerEvents] = await Promise.all([
		listDemoAuditEvents(ctx, dealId),
		listDocumensoProviderEvents(ctx, dealId),
	]);

	return [...demoEvents, ...providerEvents]
		.sort((left, right) => right.timestamp - left.timestamp)
		.slice(0, 25);
}

function buildDealSurface(graph: DemoDealGraph | null) {
	if (!graph) {
		return null;
	}

	return {
		id: graph.deal._id,
		status: graph.deal.status,
		closingDate: graph.deal.closingDate ?? null,
		fractionalShare: graph.deal.fractionalShare,
		mortgageId: graph.mortgage._id,
		property: {
			id: graph.property._id,
			streetAddress: graph.property.streetAddress,
			unit: graph.property.unit ?? null,
			city: graph.property.city,
			province: graph.property.province,
			postalCode: graph.property.postalCode,
		},
	};
}

function buildPackageSurface(
	graph: DemoDealGraph | null,
	lookup: FixedPackageLookup
) {
	if (!graph || lookup.status !== "ready") {
		return null;
	}

	return {
		packageDefinitionId: lookup.definition._id,
		packageVersionId: lookup.version._id,
		mortgageId: graph.mortgage._id,
	};
}

function buildLenderSurface(graph: DemoDealGraph | null) {
	const linkedUserId = graph?.user._id ?? null;

	return {
		authId: DEMO_LENDER.authId,
		email: DEMO_LENDER.email,
		expectedUserId: DEMO_LENDER.userId,
		fixedUserIdMatches: linkedUserId === DEMO_LENDER.userId,
		linkedUserId,
		name: DEMO_LENDER.name,
		userId: linkedUserId,
	};
}

export function toDemoSetupStatus(lookup: FixedPackageLookup): DemoSetupStatus {
	return lookup.status;
}

function missingPackageError() {
	return new ConvexError(
		`Demo deal closing setup is missing package "${DEMO_PACKAGE_TITLE}" (${DEMO_PACKAGE_DEFINITION_ID}).`
	);
}

function missingPublishedVersionError(definition: DemoPackageDefinition) {
	return new ConvexError(
		`Demo deal closing setup package "${definition.name}" (${definition._id}) has no published version.`
	);
}

export function requireResettablePackage(lookup: FixedPackageLookup): {
	definition: DemoPackageDefinition;
	version: DemoPackageVersion;
} {
	if (lookup.status === "missing_package") {
		throw missingPackageError();
	}
	if (lookup.status === "missing_published_version") {
		throw missingPublishedVersionError(lookup.definition);
	}
	return {
		definition: lookup.definition,
		version: lookup.version,
	};
}

export function assertCanOperateDemoReset(
	viewer: Pick<Viewer, "authId" | "email" | "isFairLendAdmin">,
	operation: "read" | "reset" = "reset"
): void {
	if (viewer.isFairLendAdmin) {
		return;
	}

	const viewerEmail = viewer.email?.trim().toLowerCase();
	if (
		viewer.authId === DEMO_LENDER.authId ||
		viewerEmail === DEMO_LENDER.email.toLowerCase()
	) {
		return;
	}

	throw new ConvexError(
		`Forbidden: demo ${operation} requires FairLend admin access`
	);
}

interface ResetAndRegenerateResult {
	dealId: Id<"deals">;
	mortgageId: Id<"mortgages">;
	ok: true;
	packageApplicationId: Id<"mortgagePackageApplications">;
	packageDefinitionId: Id<"documentPackageDefinitions">;
	packageGeneration: DemoGenerationResult;
	packageVersionId: Id<"documentPackageVersions">;
	status: DemoResetStatus;
}

export const getFixedPackageDefinitionInternal = convex
	.query()
	.input({})
	.handler(async (ctx): Promise<FixedPackageLookup> => {
		return await lookupFixedPackage(ctx);
	})
	.internal();

export const lookupPackageByIdAndTitleInternal = convex
	.query()
	.input({
		packageDefinitionId: v.id("documentPackageDefinitions"),
		expectedTitle: v.string(),
	})
	.handler(async (ctx, args): Promise<FixedPackageLookup> => {
		return await lookupPackageByIdAndTitle(ctx, args);
	})
	.internal();

export const ensureActivePackageApplicationInternal = convex
	.mutation()
	.input({
		mortgageId: v.id("mortgages"),
		packageVersionId: v.id("documentPackageVersions"),
		userId: v.optional(v.id("users")),
	})
	.handler(async (ctx, args) => {
		return await ensureActivePackageApplication(ctx, args);
	})
	.internal();

export const ensureDemoDealBootstrapInternal = convex
	.mutation()
	.input({
		packageDefinitionId: v.string(),
		packageVersionId: v.id("documentPackageVersions"),
	})
	.handler(async (ctx, args) => {
		const graph = await ensureDemoDealGraph(ctx);
		const resetStartedAt = Date.now();
		if (graph.deal.status !== "lawyerOnboarding.pending") {
			await ctx.db.patch(graph.deal._id, {
				lastTransitionAt: resetStartedAt,
				status: "lawyerOnboarding.pending",
			});
		}

		await appendDemoAuditEvent(ctx, {
			dealId: graph.deal._id,
			eventType: "demo_package_reset_started",
			message: "Demo deal package reset started.",
			metadata: {
				packageDefinitionId: args.packageDefinitionId,
				packageVersionId: args.packageVersionId,
			},
			mortgageId: graph.mortgage._id,
			newState: "reset_started",
			previousState: graph.deal.status,
		});

		const packageApplicationId = await ensureActivePackageApplication(ctx, {
			mortgageId: graph.mortgage._id,
			packageVersionId: args.packageVersionId,
			userId: graph.user._id,
		});

		return {
			dealId: graph.deal._id,
			mortgageId: graph.mortgage._id,
			packageApplicationId,
		};
	})
	.internal();

export const getPackageGenerationDiagnosticsInternal = convex
	.query()
	.input({
		packageId: v.id("dealDocumentPackages"),
	})
	.handler(async (ctx, args) => {
		const packageRow = await ctx.db.get(args.packageId);
		return packageRow
			? {
					lastError: packageRow.lastError ?? null,
				}
			: null;
	})
	.internal();

export const listExistingDemoProviderEnvelopeIdsInternal = convex
	.query()
	.input({
		dealId: v.id("deals"),
	})
	.handler(async (ctx, args): Promise<string[]> => {
		return await listExistingDemoProviderEnvelopeIds(ctx, args.dealId);
	})
	.internal();

export const appendDemoProviderEnvelopeCleanupAuditInternal = convex
	.mutation()
	.input({
		dealId: v.id("deals"),
		error: v.optional(v.string()),
		mortgageId: v.id("mortgages"),
		providerEnvelopeId: v.string(),
		status: signatureProviderCleanupStatusValidator,
	})
	.handler(async (ctx, args) => {
		await appendDemoAuditEvent(ctx, {
			dealId: args.dealId,
			eventType: "demo_provider_envelope_cleanup",
			message: `Demo provider envelope cleanup ${args.status} for ${args.providerEnvelopeId}.`,
			metadata: {
				error: args.error ?? null,
				providerEnvelopeId: args.providerEnvelopeId,
				status: args.status,
			},
			mortgageId: args.mortgageId,
			newState: args.status,
			previousState: "reset_started",
		});
	})
	.internal();

export const markDemoProviderEnvelopeCleanedInternal = convex
	.mutation()
	.input({
		dealId: v.id("deals"),
		providerEnvelopeId: v.string(),
		status: signatureProviderCleanupStatusValidator,
	})
	.handler(async (ctx, args) => {
		const now = Date.now();
		const signingStatus = toCleanedSigningStatus(args.status);
		const envelopes = await ctx.db
			.query("signatureEnvelopes")
			.withIndex("by_provider_envelope", (query) =>
				query
					.eq("providerCode", "documenso")
					.eq("providerEnvelopeId", args.providerEnvelopeId)
			)
			.collect();

		for (const envelope of envelopes) {
			if (envelope.dealId !== args.dealId) {
				continue;
			}
			const lastError =
				args.status === "deleted"
					? undefined
					: `Documenso cleanup ended with status ${args.status}`;

			await ctx.db.patch(envelope._id, {
				lastError,
				status: signingStatus,
				updatedAt: now,
			});
			await ctx.db.patch(envelope.generatedDocumentId, {
				documensoEnvelopeId: undefined,
				signingStatus,
				updatedAt: now,
			});
			const instances = await ctx.db
				.query("dealDocumentInstances")
				.withIndex("by_deal", (query) => query.eq("dealId", args.dealId))
				.collect();
			for (const instance of instances) {
				if (
					instance.generatedDocumentId !== envelope.generatedDocumentId ||
					instance.status === "archived"
				) {
					continue;
				}
				await ctx.db.patch(instance._id, {
					archivedAt: now,
					lastError,
					status: "archived",
					updatedAt: now,
				});
			}
		}
	})
	.internal();

export const appendDemoGenerationResultAuditInternal = convex
	.mutation()
	.input({
		dealId: v.id("deals"),
		error: v.optional(v.string()),
		generationStatus: demoGenerationStatusValidator,
		packageApplicationId: v.id("mortgagePackageApplications"),
		packageDefinitionId: v.string(),
		packageId: v.optional(v.id("dealDocumentPackages")),
		packageVersionId: v.id("documentPackageVersions"),
		mortgageId: v.id("mortgages"),
	})
	.handler(async (ctx, args) => {
		const succeeded = args.generationStatus === "ready";
		await appendDemoAuditEvent(ctx, {
			dealId: args.dealId,
			eventType: succeeded
				? "demo_package_generation_succeeded"
				: "demo_package_generation_failed",
			message: succeeded
				? "Demo deal document package generation completed."
				: "Demo deal document package generation failed.",
			metadata: {
				error: args.error ?? null,
				generationStatus: args.generationStatus,
				packageApplicationId: args.packageApplicationId,
				packageDefinitionId: args.packageDefinitionId,
				packageId: args.packageId ?? null,
				packageVersionId: args.packageVersionId,
			},
			mortgageId: args.mortgageId,
			newState: args.generationStatus,
			previousState: "reset_started",
		});
	})
	.internal();

export const approveLegalGateAndOpenSigningInternal = convex
	.mutation()
	.input({})
	.handler(async (ctx): Promise<DemoApprovalResult> => {
		const graph = await ensureDemoDealGraph(ctx);
		const previousState = graph.deal.status;

		if (previousState === "documentReview.pending") {
			return {
				ok: true,
				dealId: graph.deal._id,
				mortgageId: graph.mortgage._id,
				newState: previousState,
				previousState,
				packageGeneration: null,
				status:
					"demo_admin_approval_gate_already_open" satisfies DemoApprovalStatus,
			};
		}

		if (!canStartDemoAdminApproval(previousState)) {
			throw new ConvexError({
				code: "DEMO_APPROVAL_GATE_NOT_READY",
				message:
					"Demo admin approval is only available while the deal is locked for legal onboarding.",
				currentState: previousState,
			});
		}

		if (previousState !== "lawyerOnboarding.verified") {
			await ctx.db.patch(graph.deal._id, {
				lastTransitionAt: Date.now(),
				status: "lawyerOnboarding.verified",
			});
			await appendDemoAuditEvent(ctx, {
				dealId: graph.deal._id,
				eventType: "demo_admin_approval_gate_lawyer_verified",
				message:
					"Demo admin approval gate marked lawyer onboarding verified before opening signing.",
				metadata: {
					reason:
						"Demo reset prepares documents directly and skips the full marketplace onboarding flow.",
				},
				mortgageId: graph.mortgage._id,
				newState: "lawyerOnboarding.verified",
				previousState,
			});
		}

		const transition = await executeTransition(ctx, {
			entityId: graph.deal._id,
			entityType: "deal",
			eventType: "REPRESENTATION_CONFIRMED",
			source: {
				actorId: DEMO_ACTOR_ID,
				actorType: "admin",
				channel: "admin_dashboard",
			},
		});

		if (!transition.success) {
			throw new ConvexError({
				code: "DEMO_APPROVAL_GATE_TRANSITION_REJECTED",
				message:
					transition.reason ??
					"Demo admin approval could not advance the deal.",
				currentState: transition.previousState,
			});
		}

		await appendDemoAuditEvent(ctx, {
			dealId: graph.deal._id,
			eventType: "demo_admin_approval_gate_approved",
			message:
				"Demo admin approval gate approved. Document signing is now unlocked.",
			metadata: {
				governedTransitionEvent: "REPRESENTATION_CONFIRMED",
				transitionJournalEntryId: transition.journalEntryId ?? null,
			},
			mortgageId: graph.mortgage._id,
			newState: transition.newState,
			previousState,
		});

		return {
			ok: true,
			dealId: graph.deal._id,
			mortgageId: graph.mortgage._id,
			newState: transition.newState,
			packageGeneration: null,
			previousState,
			status: "demo_admin_approval_gate_approved" satisfies DemoApprovalStatus,
		};
	})
	.internal();

export const ensureDemoDealGraphForSigningInternal = convex
	.mutation()
	.input({})
	.handler(async (ctx) => {
		const graph = await ensureDemoDealGraph(ctx);
		return {
			dealId: graph.deal._id,
			mortgageId: graph.mortgage._id,
		};
	})
	.internal();

export const getState = authedQuery
	.input({})
	.handler(async (ctx) => {
		assertCanOperateDemoReset(ctx.viewer, "read");

		const lookup = await lookupFixedPackage(ctx);
		const status = toDemoSetupStatus(lookup);
		const graph = await findDemoDealGraph(ctx);
		const auditTrail = graph
			? await listDemoAuditTrail(ctx, graph.deal._id)
			: [];

		return {
			setup: {
				status,
			},
			canReset: status === "ready",
			packageDefinition: buildPackageDefinitionSurface(lookup),
			lender: buildLenderSurface(graph),
			deal: buildDealSurface(graph),
			package: buildPackageSurface(graph, lookup),
			auditTrail,
		};
	})
	.public();

export const approveLegalGateAndOpenSigning = authedAction
	.input({})
	.handler(async (ctx): Promise<DemoApprovalResult> => {
		assertCanOperateDemoReset(ctx.viewer);

		const approval = await ctx.runMutation(
			internal.demo.dealClosingPipeline.approveLegalGateAndOpenSigningInternal,
			{}
		);
		if (approval.newState !== "documentReview.pending") {
			return approval;
		}

		let packageGeneration: DemoGenerationResult;
		try {
			const generationResult = await ctx.runAction(
				internal.documents.dealPackages.runCreateDocumentPackageInternal,
				{
					dealId: approval.dealId,
					retry: true,
				}
			);
			const packageRow = await ctx.runQuery(
				internal.demo.dealClosingPipeline
					.getPackageGenerationDiagnosticsInternal,
				{
					packageId: generationResult.packageId,
				}
			);
			packageGeneration = buildDemoGenerationResult({
				generationResult,
				packageRow,
			});
		} catch (error) {
			packageGeneration = {
				error: error instanceof Error ? error.message : String(error),
				packageId: null,
				status: "generation_failed",
			};
		}

		return {
			...approval,
			packageGeneration,
		};
	})
	.public();

export const createDemoEmbeddedSigningSession = authedAction
	.input({
		dealId: v.id("deals"),
		instanceId: v.id("dealDocumentInstances"),
	})
	.handler(async (ctx, args): Promise<{ expiresAt: number; url: string }> => {
		assertCanOperateDemoReset(ctx.viewer);

		const graph = await ctx.runMutation(
			internal.demo.dealClosingPipeline.ensureDemoDealGraphForSigningInternal,
			{}
		);
		if (args.dealId !== graph.dealId) {
			throw new ConvexError(
				"Forbidden: demo signing is only available for the fixed demo deal"
			);
		}

		const signableDocument = (await ctx.runQuery(
			internal.documents.dealPackages
				.getSignableDocumentEnvelopeByInstanceInternal,
			{
				dealId: args.dealId,
				instanceId: args.instanceId,
			}
		)) as DemoSignableEnvelopeDocument | null;

		if (!signableDocument) {
			throw new ConvexError("Signable document envelope not found");
		}
		if (!isDealStatusOpenForEmbeddedSigning(signableDocument.dealStatus)) {
			throw new ConvexError(
				"Embedded signing is locked until lawyer representation is confirmed."
			);
		}
		if (
			signableDocument.envelope.status !== "sent" &&
			signableDocument.envelope.status !== "partially_signed"
		) {
			throw new ConvexError(
				"Embedded signing is not available for the current envelope state"
			);
		}

		const recipient = findNextDemoSigningRecipient(signableDocument);
		if (!recipient?.providerRecipientId) {
			throw new ConvexError(
				"No pending Documenso recipient is available for demo signing"
			);
		}

		const provider = getSignatureProvider(
			signableDocument.envelope.providerCode,
			{
				fetchFn: fetch,
				getStorageBlob: async () => null,
			}
		);

		return provider.createEmbeddedSigningSession({
			providerEnvelopeId: signableDocument.envelope.providerEnvelopeId,
			providerRecipientId: recipient.providerRecipientId,
		});
	})
	.public();

export const resetAndRegenerate = authedAction
	.input({})
	.handler(async (ctx): Promise<ResetAndRegenerateResult> => {
		assertCanOperateDemoReset(ctx.viewer);

		const lookup: FixedPackageLookup = await ctx.runQuery(
			internal.demo.dealClosingPipeline.getFixedPackageDefinitionInternal,
			{}
		);
		const { definition, version } = requireResettablePackage(lookup);
		const bootstrapped = await ctx.runMutation(
			internal.demo.dealClosingPipeline.ensureDemoDealBootstrapInternal,
			{
				packageDefinitionId: definition._id,
				packageVersionId: version._id,
			}
		);
		const cleanupEnvelopeIds = await ctx.runQuery(
			internal.demo.dealClosingPipeline
				.listExistingDemoProviderEnvelopeIdsInternal,
			{
				dealId: bootstrapped.dealId,
			}
		);
		for (const providerEnvelopeId of cleanupEnvelopeIds) {
			const cleanupResult =
				await cleanupDemoDocumensoEnvelope(providerEnvelopeId);
			await ctx.runMutation(
				internal.demo.dealClosingPipeline
					.appendDemoProviderEnvelopeCleanupAuditInternal,
				{
					dealId: bootstrapped.dealId,
					error: cleanupResult.error,
					mortgageId: bootstrapped.mortgageId,
					providerEnvelopeId: cleanupResult.providerEnvelopeId,
					status: cleanupResult.status,
				}
			);
			await ctx.runMutation(
				internal.demo.dealClosingPipeline
					.markDemoProviderEnvelopeCleanedInternal,
				{
					dealId: bootstrapped.dealId,
					providerEnvelopeId: cleanupResult.providerEnvelopeId,
					status: cleanupResult.status,
				}
			);
		}
		let packageGeneration: DemoGenerationResult;
		try {
			const generationResult = await ctx.runAction(
				internal.documents.dealPackages.runCreateDocumentPackageInternal,
				{
					dealId: bootstrapped.dealId,
					retry: true,
				}
			);
			const packageRow = await ctx.runQuery(
				internal.demo.dealClosingPipeline
					.getPackageGenerationDiagnosticsInternal,
				{
					packageId: generationResult.packageId,
				}
			);
			packageGeneration = buildDemoGenerationResult({
				generationResult,
				packageRow,
			});
		} catch (error) {
			packageGeneration = {
				error: error instanceof Error ? error.message : String(error),
				packageId: null,
				status: "generation_failed",
			};
		}
		await ctx.runMutation(
			internal.demo.dealClosingPipeline.appendDemoGenerationResultAuditInternal,
			{
				dealId: bootstrapped.dealId,
				error: packageGeneration.error ?? undefined,
				generationStatus: packageGeneration.status,
				packageApplicationId: bootstrapped.packageApplicationId,
				packageDefinitionId: definition._id,
				packageId: packageGeneration.packageId ?? undefined,
				packageVersionId: version._id,
				mortgageId: bootstrapped.mortgageId,
			}
		);
		const status: DemoResetStatus =
			packageGeneration.status === "ready"
				? "demo_package_generation_succeeded"
				: "demo_package_generation_failed";

		return {
			ok: true,
			dealId: bootstrapped.dealId,
			mortgageId: bootstrapped.mortgageId,
			packageApplicationId: bootstrapped.packageApplicationId,
			packageDefinitionId: definition._id,
			packageGeneration,
			packageVersionId: version._id,
			status,
		};
	})
	.public();
