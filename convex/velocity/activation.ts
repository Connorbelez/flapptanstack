import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { adminAction, convex } from "../fluent";
import { activateMortgageAggregate } from "../mortgages/activateMortgageAggregate";
import {
	createRotessaClient,
	RotessaApiError,
	RotessaRequestError,
} from "../payments/rotessa/client";
import {
	computeScheduledInstallmentCount,
	type NormalizedRotessaCustomerSnapshot,
	type NormalizedRotessaScheduleSnapshot,
	upsertExternalCustomerProfile,
	upsertExternalProviderSchedulesForCustomer,
} from "../payments/rotessa/readModel";
import type { RotessaCustomerDetail } from "../payments/rotessa/types";
import { normalizeEmail } from "../seed/seedHelpers";
import { upsertUserByAuthId } from "../users/byAuthId";
import { buildVelocityActivationHandoff } from "./activationMapper";
import { appendVelocityPackageAuditEntry } from "./audit";
import {
	buildVelocityActivationIdempotencyKey,
	buildVelocityMortgageWorkflowSourceKey,
	VELOCITY_CREATION_SOURCE,
	VELOCITY_WORKFLOW_SOURCE_TYPE,
} from "./constants";
import type {
	VelocityActivationHandoffV1,
	VelocityPackageAuditPayload,
} from "./contracts";
import { computeVelocityReadiness } from "./sync";

type VelocityWorkspace = Doc<"velocityPackageWorkspaces">;
type ActivationAttempt = Doc<"velocityActivationAttempts">;
type ActivationStatus = ActivationAttempt["status"];
const WHITESPACE_PATTERN = /\s+/;

interface VelocityCanonicalInputs {
	bankAccountId: Id<"bankAccounts">;
	borrowerLinks: VelocityActivationHandoffV1["borrowerLinks"];
	brokerOfRecordId: Id<"brokers">;
	primaryBorrower: {
		borrowerId: Id<"borrowers">;
		email: string;
		fullName: string;
		phone?: string;
	};
}

interface PreparedVelocityActivation {
	activationAttemptId: Id<"velocityActivationAttempts">;
	amountCents: number;
	bankAccount: {
		accountNumber: string;
		institutionNumber: string;
		transitNumber: string;
	};
	bankAccountId: Id<"bankAccounts">;
	customerCustomIdentifier: string;
	customerEmail: string;
	customerName: string;
	customerPhone?: string;
	firstPaymentDate: string;
	idempotencyKey: string;
	installments: number;
	maturityDate: string;
	paymentFrequency: Doc<"mortgages">["paymentFrequency"];
	rotessaCustomerRef?: string;
	rotessaScheduleRef?: string;
	scheduleComment: string;
	scheduleFrequency: "Every Other Week" | "Monthly" | "Weekly";
	workspaceId: Id<"velocityPackageWorkspaces">;
}

interface RotessaFailureMetadata {
	compensatedRotessaScheduleRef?: string;
	failureDetails?: Record<string, unknown>;
}

const startVelocityPackageActivationRef = makeFunctionReference<
	"mutation",
	{
		actorAuthId: string;
		reviewedSnapshotHash: string;
		reviewedSnapshotId: Id<"velocityPackageSnapshots">;
		workspaceId: Id<"velocityPackageWorkspaces">;
	},
	Promise<{
		activationAttemptId: Id<"velocityActivationAttempts">;
		mortgageId?: Id<"mortgages">;
		status: ActivationStatus;
	}>
>("velocity/activation:startVelocityPackageActivation");

const prepareVelocityPackageActivationRef = makeFunctionReference<
	"mutation",
	{
		activationAttemptId: Id<"velocityActivationAttempts">;
		actorAuthId: string;
	},
	Promise<PreparedVelocityActivation>
>("velocity/activation:prepareVelocityPackageActivation");

const recordVelocityRotessaCustomerRefRef = makeFunctionReference<
	"mutation",
	{
		activationAttemptId: Id<"velocityActivationAttempts">;
		customer: {
			accountLast4?: string;
			accountNumber?: string;
			authorizationType?: string;
			bankAccountType?: string;
			bankName?: string;
			customerType?: string;
			email?: string;
			externalCustomerCustomIdentifier?: string;
			externalCustomerRef: string;
			fullName: string;
			institutionNumber?: string;
			phone?: string;
			transitNumber?: string;
		};
	},
	Promise<{
		bankAccountId?: Id<"bankAccounts">;
		customerProfileId: Id<"externalCustomerProfiles">;
		rotessaCustomerRef: string;
	}>
>("velocity/activation:recordVelocityRotessaCustomerRef");

const recordVelocityRotessaScheduleRefRef = makeFunctionReference<
	"mutation",
	{
		activationAttemptId: Id<"velocityActivationAttempts">;
		schedule: {
			amountCents: number;
			comment?: string;
			externalScheduleRef: string;
			frequency: string;
			installments?: number;
			nextProcessDate?: string;
			processDate: string;
			providerScheduleStatus?: string;
		};
	},
	Promise<{ rotessaScheduleRef: string }>
>("velocity/activation:recordVelocityRotessaScheduleRef");

const finalizeVelocityPackageActivationRef = makeFunctionReference<
	"mutation",
	{
		activationAttemptId: Id<"velocityActivationAttempts">;
	},
	Promise<{
		activationAttemptId: Id<"velocityActivationAttempts">;
		mortgageId: Id<"mortgages">;
		status: "succeeded";
	}>
>("velocity/activation:finalizeVelocityPackageActivation");

const failVelocityPackageActivationRef = makeFunctionReference<
	"mutation",
	{
		activationAttemptId: Id<"velocityActivationAttempts">;
		compensatedRotessaScheduleRef?: string;
		failureDetails?: Record<string, unknown>;
		failureCode: string;
		failureMessage: string;
	},
	Promise<{ status: "failed" }>
>("velocity/activation:failVelocityPackageActivation");

function requireWorkspace(
	workspace: VelocityWorkspace | null
): VelocityWorkspace {
	if (!workspace) {
		throw new ConvexError("Velocity package workspace not found");
	}
	return workspace;
}

function requireValue<T>(
	value: T | null | undefined,
	message: string
): Exclude<T, null | undefined> {
	if (value === null || value === undefined || value === "") {
		throw new ConvexError(message);
	}
	return value as Exclude<T, null | undefined>;
}

function splitName(fullName: string) {
	const [firstName, ...rest] = fullName.trim().split(WHITESPACE_PATTERN);
	return {
		firstName: firstName || "Velocity",
		lastName: rest.join(" ") || "Borrower",
	};
}

function formatActivationError(error: unknown) {
	if (error instanceof RotessaApiError) {
		return `${error.message} (${error.method} ${error.path})`;
	}
	if (error instanceof RotessaRequestError) {
		return `${error.message} (${error.method} ${error.path})`;
	}
	if (error instanceof Error) {
		return error.message;
	}
	return "Unknown Velocity activation error";
}

function formatProviderFailureDetails(error: unknown): Record<string, unknown> {
	if (error instanceof RotessaApiError) {
		return {
			errors: error.errors,
			method: error.method,
			path: error.path,
			responseText: error.responseText,
			status: error.status,
		};
	}
	if (error instanceof RotessaRequestError) {
		return {
			method: error.method,
			path: error.path,
		};
	}
	return {};
}

function isRotessaNotFound(error: unknown) {
	return error instanceof RotessaApiError && error.status === 404;
}

function mapMortgageFrequencyToRotessaFrequency(
	paymentFrequency: Doc<"mortgages">["paymentFrequency"]
) {
	switch (paymentFrequency) {
		case "monthly":
			return "Monthly" as const;
		case "bi_weekly":
		case "accelerated_bi_weekly":
			return "Every Other Week" as const;
		case "weekly":
			return "Weekly" as const;
		default:
			throw new ConvexError(
				"Velocity activation mortgage payment frequency is not supported by Rotessa."
			);
	}
}

function toRotessaAmount(cents: number) {
	return Number((cents / 100).toFixed(2));
}

function rotessaAmountMatches(rawAmount: string, cents: number) {
	return (
		Number.parseFloat(rawAmount).toFixed(2) ===
		toRotessaAmount(cents).toFixed(2)
	);
}

function resolveNextActivationProviderStage(attempt: ActivationAttempt) {
	if (attempt.rotessaScheduleRef) {
		return "creating_canonical_mortgage" as const;
	}
	if (attempt.rotessaCustomerRef) {
		return "creating_rotessa_schedule" as const;
	}
	return "creating_rotessa_customer" as const;
}

function resolveVelocityBorrowerExternalKeys(args: {
	borrower: VelocityWorkspace["normalizedCore"]["borrowers"][number];
	index: number;
}) {
	return new Set(
		[
			args.borrower.email,
			args.borrower.fullName,
			`${args.index}`,
			`borrower:${args.index}`,
			`borrower:${args.borrower.email ?? args.index}`,
		].filter((value): value is string => Boolean(value))
	);
}

function resolveVelocityBorrowerRole(args: {
	borrower: VelocityWorkspace["normalizedCore"]["borrowers"][number];
	index: number;
	workspace: VelocityWorkspace;
}) {
	const externalKeys = resolveVelocityBorrowerExternalKeys(args);
	const override =
		args.workspace.fairlendEnrichment.activationRemediation?.borrowerRoleOverrides?.find(
			(candidate) => externalKeys.has(candidate.borrowerExternalKey)
		);
	return override?.role ?? (args.index === 0 ? "primary" : "co_borrower");
}

async function requireViewerUserId(
	ctx: Pick<MutationCtx, "db">,
	actorAuthId: string
) {
	const user = await ctx.db
		.query("users")
		.withIndex("authId", (query) => query.eq("authId", actorAuthId))
		.unique();
	if (!user) {
		throw new ConvexError("User not found in database");
	}
	return user._id;
}

function assertFinalReviewMatches(args: {
	reviewedSnapshotHash: string;
	reviewedSnapshotId: Id<"velocityPackageSnapshots">;
	workspace: VelocityWorkspace;
}) {
	const finalReview = args.workspace.finalReview;
	if (!finalReview) {
		throw new ConvexError(
			"Velocity package requires final review before activation."
		);
	}
	if (finalReview.reviewedSnapshotId !== args.reviewedSnapshotId) {
		throw new ConvexError(
			"Velocity activation reviewed snapshot does not match final review."
		);
	}
	if (finalReview.reviewedSnapshotHash !== args.reviewedSnapshotHash) {
		throw new ConvexError(
			"Velocity activation reviewed snapshot hash does not match final review."
		);
	}
	if (args.workspace.normalizedCoreHash !== args.reviewedSnapshotHash) {
		throw new ConvexError(
			"Velocity-owned core data changed after final review; refresh review before activation."
		);
	}
}

function assertActivationReadiness(workspace: VelocityWorkspace) {
	const readiness = computeVelocityReadiness({
		core: workspace.normalizedCore,
		enrichment: workspace.fairlendEnrichment,
		workspace,
	});
	if (!readiness.canActivate) {
		throw new ConvexError(
			`Velocity package is not ready for activation: ${readiness.blockers
				.map((blocker) => blocker.message)
				.join("; ")}`
		);
	}
	return readiness;
}

async function assertNoLiveMortgageForWorkflowSource(
	ctx: Pick<MutationCtx, "db">,
	workspace: VelocityWorkspace
) {
	const workflowSourceKey = buildVelocityMortgageWorkflowSourceKey(
		workspace.linkApplicationId
	);
	const existingMortgage = await ctx.db
		.query("mortgages")
		.withIndex("by_workflow_source_key", (query) =>
			query.eq("workflowSourceKey", workflowSourceKey)
		)
		.unique();
	if (existingMortgage) {
		throw new ConvexError(
			`Velocity package already activated mortgage ${existingMortgage._id}.`
		);
	}
}

async function appendActivationAuditEntry(
	ctx: MutationCtx,
	args: {
		actorAuthId: string;
		activationAttemptId: Id<"velocityActivationAttempts">;
		eventType:
			| "velocity_activation_attempt_started"
			| "velocity_activation_failed"
			| "velocity_activation_provider_artifact_recorded"
			| "velocity_activation_provider_artifact_reused"
			| "velocity_activation_stage_changed"
			| "velocity_activation_succeeded";
		failureMessage?: string;
		linkedRecordIds?: Record<string, unknown>;
		newState?: string;
		payloadExtras?: VelocityPackageAuditPayload;
		previousState?: string;
		providerArtifactRef?: string;
		providerArtifactType?: "rotessa_customer" | "rotessa_schedule";
		stage?: string;
		workspace: VelocityWorkspace;
	}
) {
	const payload = {
		activationAttemptId: String(args.activationAttemptId),
		failureMessage: args.failureMessage,
		linkApplicationId: args.workspace.linkApplicationId,
		loanCode: args.workspace.loanCode,
		normalizedCoreHash: args.workspace.normalizedCoreHash,
		providerArtifactRef: args.providerArtifactRef,
		providerArtifactType: args.providerArtifactType,
		stage: args.stage,
		workspaceId: String(args.workspace._id),
		...(args.payloadExtras ?? {}),
	} satisfies VelocityPackageAuditPayload & {
		failureMessage?: string;
		providerArtifactRef?: string;
		providerArtifactType?: "rotessa_customer" | "rotessa_schedule";
		stage?: string;
	};
	await appendVelocityPackageAuditEntry(ctx, {
		actorId: args.actorAuthId,
		actorType: "admin",
		channel: "admin_dashboard",
		eventType: args.eventType,
		linkedRecordIds: args.linkedRecordIds,
		newState: args.newState ?? args.workspace.state,
		organizationId: args.workspace.orgId,
		outcome:
			args.eventType === "velocity_activation_failed"
				? "rejected"
				: "transitioned",
		payload,
		previousState: args.previousState ?? args.workspace.state,
		workspaceId: args.workspace._id,
	});
}

async function requireActivationAttempt(
	ctx: Pick<MutationCtx, "db">,
	activationAttemptId: Id<"velocityActivationAttempts">
) {
	const attempt = await ctx.db.get(activationAttemptId);
	if (!attempt) {
		throw new ConvexError("Velocity activation attempt not found.");
	}
	return attempt;
}

async function loadAttemptWorkspaceAndSnapshot(
	ctx: Pick<MutationCtx, "db">,
	activationAttemptId: Id<"velocityActivationAttempts">
) {
	const attempt = await requireActivationAttempt(ctx, activationAttemptId);
	const workspace = requireWorkspace(await ctx.db.get(attempt.workspaceId));
	const snapshot = await ctx.db.get(attempt.reviewedSnapshotId);
	if (!snapshot || snapshot.workspaceId !== workspace._id) {
		throw new ConvexError(
			"Velocity activation reviewed snapshot was not found for workspace."
		);
	}
	return { attempt, snapshot, workspace };
}

async function ensureVelocityBroker(
	ctx: Pick<MutationCtx, "db">,
	args: {
		now: number;
		workspace: VelocityWorkspace;
	}
) {
	const explicitBrokerId =
		args.workspace.fairlendEnrichment.activationRemediation?.brokerOfRecordId;
	if (explicitBrokerId) {
		const broker = await ctx.db.get(explicitBrokerId);
		if (!broker) {
			throw new ConvexError("Velocity broker of record no longer exists.");
		}
		return explicitBrokerId;
	}

	const authId = `velocity_package:broker:${args.workspace.linkApplicationId}`;
	const user = await upsertUserByAuthId(ctx, {
		authId,
		email: `velocity-broker+${args.workspace.linkApplicationId.toLowerCase()}@fairlend.local`,
		firstName: "Velocity",
		lastName: "Broker",
	});
	const existingBroker = await ctx.db
		.query("brokers")
		.withIndex("by_user", (query) => query.eq("userId", user.canonicalUser._id))
		.first();
	if (existingBroker) {
		return existingBroker._id;
	}
	return ctx.db.insert("brokers", {
		brokerageName: args.workspace.normalizedCore.upstream.agent ?? "Velocity",
		createdAt: args.now,
		lastTransitionAt: args.now,
		orgId: args.workspace.orgId,
		status: "active",
		userId: user.canonicalUser._id,
	});
}

async function findOrCreateVelocityBorrower(
	ctx: Pick<MutationCtx, "db">,
	args: {
		email: string;
		fullName: string;
		index: number;
		now: number;
		phone?: string;
		workspace: VelocityWorkspace;
	}
) {
	const email = normalizeEmail(args.email);
	const name = splitName(args.fullName);
	const existingUser = await ctx.db
		.query("users")
		.withIndex("by_email", (query) => query.eq("email", email))
		.first();
	const userId =
		existingUser?._id ??
		(await ctx.db.insert("users", {
			authId: `velocity_package:${args.workspace.linkApplicationId}:borrower:${args.index}:${email}`,
			email,
			firstName: name.firstName,
			lastName: name.lastName,
			phoneNumber: args.phone,
		}));
	if (existingUser) {
		await ctx.db.patch(existingUser._id, {
			firstName: existingUser.firstName || name.firstName,
			lastName: existingUser.lastName || name.lastName,
			phoneNumber: existingUser.phoneNumber ?? args.phone,
		});
	}

	const existingBorrowers = await ctx.db
		.query("borrowers")
		.withIndex("by_user", (query) => query.eq("userId", userId))
		.collect();
	const sameOrgBorrower = existingBorrowers.find(
		(borrower) => borrower.orgId === args.workspace.orgId
	);
	if (sameOrgBorrower) {
		return sameOrgBorrower._id;
	}

	return ctx.db.insert("borrowers", {
		creationSource: VELOCITY_CREATION_SOURCE,
		createdAt: args.now,
		lastTransitionAt: args.now,
		onboardedAt: args.now,
		orgId: args.workspace.orgId,
		originatingWorkflowId: String(args.workspace._id),
		originatingWorkflowType: VELOCITY_WORKFLOW_SOURCE_TYPE,
		status: "active",
		userId,
		workflowSourceId: String(args.workspace._id),
		workflowSourceKey: `${VELOCITY_WORKFLOW_SOURCE_TYPE}:borrower:${args.workspace.linkApplicationId}:${email}`,
		workflowSourceType: VELOCITY_WORKFLOW_SOURCE_TYPE,
	});
}

async function ensureVelocityBankAccount(
	ctx: Pick<MutationCtx, "db">,
	args: {
		borrowerId: Id<"borrowers">;
		now: number;
		workspace: VelocityWorkspace;
	}
) {
	const bankInput = args.workspace.fairlendEnrichment.bankInput;
	const accountNumber = requireValue(
		bankInput?.accountNumber,
		"Velocity activation requires bank account number."
	);
	const institutionNumber = requireValue(
		bankInput?.institutionNumber,
		"Velocity activation requires bank institution number."
	);
	const transitNumber = requireValue(
		bankInput?.transitNumber,
		"Velocity activation requires bank transit number."
	);
	const ownerId = String(args.borrowerId);
	const existingAccounts = await ctx.db
		.query("bankAccounts")
		.withIndex("by_owner", (query) =>
			query.eq("ownerType", "borrower").eq("ownerId", ownerId)
		)
		.collect();
	const accountLast4 = bankInput?.accountLast4 ?? accountNumber.slice(-4);
	const existingAccount =
		existingAccounts.find(
			(account) => account.accountNumber === accountNumber
		) ??
		existingAccounts.find(
			(account) =>
				account.accountLast4 === accountLast4 &&
				account.institutionNumber === institutionNumber &&
				account.transitNumber === transitNumber
		);
	if (existingAccount) {
		await ctx.db.patch(existingAccount._id, {
			accountLast4,
			accountNumber,
			country: "CA",
			currency: "CAD",
			institutionNumber,
			isDefaultInbound:
				existingAccount.isDefaultInbound ??
				!existingAccounts.some((account) => account.isDefaultInbound),
			mandateStatus: "active",
			status: "validated",
			transitNumber,
			updatedAt: args.now,
			validationMethod: existingAccount.validationMethod ?? "manual",
		});
		return existingAccount._id;
	}
	return ctx.db.insert("bankAccounts", {
		accountLast4,
		accountNumber,
		country: "CA",
		createdAt: args.now,
		currency: "CAD",
		institutionNumber,
		isDefaultInbound: !existingAccounts.some(
			(account) => account.isDefaultInbound
		),
		mandateStatus: "active",
		ownerId,
		ownerType: "borrower",
		status: "validated",
		transitNumber,
		updatedAt: args.now,
		validationMethod: "manual",
	});
}

async function ensureVelocityCanonicalInputs(
	ctx: Pick<MutationCtx, "db">,
	args: {
		now: number;
		workspace: VelocityWorkspace;
	}
): Promise<VelocityCanonicalInputs> {
	const brokerOfRecordId = await ensureVelocityBroker(ctx, args);
	const borrowerLinks: VelocityActivationHandoffV1["borrowerLinks"] = [];
	let primaryBorrower: VelocityCanonicalInputs["primaryBorrower"] | null = null;

	for (const [
		index,
		borrower,
	] of args.workspace.normalizedCore.borrowers.entries()) {
		const email = requireValue(
			borrower.email,
			"Velocity activation requires borrower email."
		);
		const fullName = requireValue(
			borrower.fullName ||
				[borrower.firstName, borrower.lastName].filter(Boolean).join(" "),
			"Velocity activation requires borrower name."
		);
		const borrowerId = await findOrCreateVelocityBorrower(ctx, {
			email,
			fullName,
			index,
			now: args.now,
			phone: borrower.cellPhone ?? borrower.homePhone ?? undefined,
			workspace: args.workspace,
		});
		const role = resolveVelocityBorrowerRole({
			borrower,
			index,
			workspace: args.workspace,
		});
		borrowerLinks.push({ borrowerId, role });
		if (!primaryBorrower) {
			primaryBorrower = {
				borrowerId,
				email: normalizeEmail(email),
				fullName,
				phone: borrower.cellPhone ?? borrower.homePhone ?? undefined,
			};
		}
	}

	if (!primaryBorrower) {
		throw new ConvexError(
			"Velocity activation requires at least one borrower."
		);
	}

	const bankAccountId = await ensureVelocityBankAccount(ctx, {
		borrowerId: primaryBorrower.borrowerId,
		now: args.now,
		workspace: args.workspace,
	});
	return {
		bankAccountId,
		borrowerLinks,
		brokerOfRecordId,
		primaryBorrower,
	};
}

function buildPreparedActivation(args: {
	attempt: ActivationAttempt;
	canonical: VelocityCanonicalInputs;
	workspace: VelocityWorkspace;
}): PreparedVelocityActivation {
	const mortgage = args.workspace.normalizedCore.mortgageRequest;
	const bankInput = args.workspace.fairlendEnrichment.bankInput;
	const paymentAmount = requireValue(
		mortgage.paymentAmount,
		"Velocity activation requires payment amount."
	);
	const firstPaymentDate = requireValue(
		mortgage.firstPaymentDate,
		"Velocity activation requires first payment date."
	);
	const maturityDate = requireValue(
		mortgage.maturityDate,
		"Velocity activation requires maturity date."
	);
	const paymentFrequency = requireValue(
		mortgage.fairlendPaymentFrequency,
		"Velocity activation requires supported payment frequency."
	);
	return {
		activationAttemptId: args.attempt._id,
		amountCents: paymentAmount,
		bankAccount: {
			accountNumber: requireValue(
				bankInput?.accountNumber,
				"Velocity activation requires bank account number."
			),
			institutionNumber: requireValue(
				bankInput?.institutionNumber,
				"Velocity activation requires bank institution number."
			),
			transitNumber: requireValue(
				bankInput?.transitNumber,
				"Velocity activation requires bank transit number."
			),
		},
		bankAccountId: args.canonical.bankAccountId,
		customerCustomIdentifier: `${VELOCITY_WORKFLOW_SOURCE_TYPE}:${args.workspace.linkApplicationId}:borrower:${args.canonical.primaryBorrower.email}:bank:${args.canonical.bankAccountId}`,
		customerEmail: args.canonical.primaryBorrower.email,
		customerName: args.canonical.primaryBorrower.fullName,
		customerPhone: args.canonical.primaryBorrower.phone,
		firstPaymentDate,
		idempotencyKey: args.attempt.idempotencyKey,
		installments: computeScheduledInstallmentCount({
			firstPaymentDate,
			maturityDate,
			paymentFrequency,
		}),
		maturityDate,
		paymentFrequency,
		rotessaCustomerRef: args.attempt.rotessaCustomerRef,
		rotessaScheduleRef: args.attempt.rotessaScheduleRef,
		scheduleComment: `${VELOCITY_WORKFLOW_SOURCE_TYPE}:${args.workspace.linkApplicationId}`,
		scheduleFrequency: mapMortgageFrequencyToRotessaFrequency(paymentFrequency),
		workspaceId: args.workspace._id,
	};
}

async function findRotessaCustomerByCustomIdentifier(
	client: ReturnType<typeof createRotessaClient>,
	customIdentifier: string
) {
	try {
		return await client.customers.getByCustomIdentifier(customIdentifier);
	} catch (error) {
		if (isRotessaNotFound(error)) {
			return null;
		}
		throw error;
	}
}

function findMatchingRotessaSchedule(
	customer: RotessaCustomerDetail | null,
	prepared: PreparedVelocityActivation
) {
	return customer?.transaction_schedules.find(
		(schedule) =>
			schedule.comment === prepared.scheduleComment &&
			schedule.frequency === prepared.scheduleFrequency &&
			schedule.process_date === prepared.firstPaymentDate &&
			rotessaAmountMatches(schedule.amount, prepared.amountCents)
	);
}

async function resolveOrCreateRotessaCustomer(
	client: ReturnType<typeof createRotessaClient>,
	prepared: PreparedVelocityActivation
) {
	const existing = await findRotessaCustomerByCustomIdentifier(
		client,
		prepared.customerCustomIdentifier
	);
	if (existing) {
		return existing;
	}
	try {
		return await client.customers.create({
			account_number: prepared.bankAccount.accountNumber,
			authorization_type: "Online",
			bank_account_type: "Checking",
			custom_identifier: prepared.customerCustomIdentifier,
			email: prepared.customerEmail,
			institution_number: prepared.bankAccount.institutionNumber,
			name: prepared.customerName,
			phone: prepared.customerPhone,
			transit_number: prepared.bankAccount.transitNumber,
		});
	} catch (error) {
		const recovered = await findRotessaCustomerByCustomIdentifier(
			client,
			prepared.customerCustomIdentifier
		);
		if (recovered) {
			return recovered;
		}
		throw error;
	}
}

async function resolveOrCreateRotessaSchedule(
	client: ReturnType<typeof createRotessaClient>,
	prepared: PreparedVelocityActivation
) {
	const customer = await findRotessaCustomerByCustomIdentifier(
		client,
		prepared.customerCustomIdentifier
	);
	const existing = findMatchingRotessaSchedule(customer, prepared);
	if (existing) {
		return existing;
	}
	try {
		return await client.transactionSchedules.createWithCustomIdentifier({
			amount: toRotessaAmount(prepared.amountCents),
			comment: prepared.scheduleComment,
			custom_identifier: prepared.customerCustomIdentifier,
			frequency: prepared.scheduleFrequency,
			installments: prepared.installments,
			process_date: prepared.firstPaymentDate,
		});
	} catch (error) {
		const recoveredCustomer = await findRotessaCustomerByCustomIdentifier(
			client,
			prepared.customerCustomIdentifier
		);
		const recoveredSchedule = findMatchingRotessaSchedule(
			recoveredCustomer,
			prepared
		);
		if (recoveredSchedule) {
			return recoveredSchedule;
		}
		throw error;
	}
}

async function compensateRotessaSchedule(
	client: ReturnType<typeof createRotessaClient>,
	rotessaScheduleRef: string
): Promise<RotessaFailureMetadata> {
	const parsedId = Number.parseInt(rotessaScheduleRef, 10);
	if (!Number.isFinite(parsedId)) {
		return {
			failureDetails: {
				compensationSkipped:
					"Rotessa schedule ref is not a numeric provider identifier.",
				rotessaScheduleRef,
			},
		};
	}
	try {
		await client.transactionSchedules.delete(parsedId);
		return { compensatedRotessaScheduleRef: rotessaScheduleRef };
	} catch (error) {
		return {
			failureDetails: {
				compensationError: formatActivationError(error),
				...formatProviderFailureDetails(error),
				rotessaScheduleRef,
			},
		};
	}
}

export const startVelocityPackageActivation = convex
	.mutation()
	.input({
		actorAuthId: v.string(),
		reviewedSnapshotHash: v.string(),
		reviewedSnapshotId: v.id("velocityPackageSnapshots"),
		workspaceId: v.id("velocityPackageWorkspaces"),
	})
	.handler(async (ctx, args) => {
		const workspace = requireWorkspace(await ctx.db.get(args.workspaceId));
		const snapshot = await ctx.db.get(args.reviewedSnapshotId);
		if (!snapshot || snapshot.workspaceId !== workspace._id) {
			throw new ConvexError(
				"Velocity package reviewed snapshot was not found for workspace."
			);
		}
		if (snapshot.normalizedCoreHash !== args.reviewedSnapshotHash) {
			throw new ConvexError(
				"Velocity package reviewed snapshot hash does not match request."
			);
		}

		const idempotencyKey = buildVelocityActivationIdempotencyKey({
			reviewedSnapshotHash: args.reviewedSnapshotHash,
			workspaceId: String(workspace._id),
		});
		const existingAttempt = await ctx.db
			.query("velocityActivationAttempts")
			.withIndex("by_idempotency_key", (query) =>
				query.eq("idempotencyKey", idempotencyKey)
			)
			.first();
		if (existingAttempt) {
			return {
				activationAttemptId: existingAttempt._id,
				mortgageId: existingAttempt.mortgageId,
				status: existingAttempt.status,
			};
		}

		assertFinalReviewMatches({
			reviewedSnapshotHash: args.reviewedSnapshotHash,
			reviewedSnapshotId: args.reviewedSnapshotId,
			workspace,
		});
		const readiness = assertActivationReadiness(workspace);
		await assertNoLiveMortgageForWorkflowSource(ctx, workspace);

		const actorUserId = await requireViewerUserId(ctx, args.actorAuthId);
		const now = Date.now();
		const activationAttemptId = await ctx.db.insert(
			"velocityActivationAttempts",
			{
				actorAuthId: args.actorAuthId,
				actorUserId,
				idempotencyKey,
				reviewedSnapshotHash: args.reviewedSnapshotHash,
				reviewedSnapshotId: args.reviewedSnapshotId,
				startedAt: now,
				status: "validating",
				workspaceId: workspace._id,
			}
		);

		await ctx.db.patch(workspace._id, {
			readiness,
			state: "activating",
			updatedAt: now,
		});
		await appendActivationAuditEntry(ctx as MutationCtx, {
			actorAuthId: args.actorAuthId,
			activationAttemptId,
			eventType: "velocity_activation_attempt_started",
			newState: "activating",
			previousState: workspace.state,
			stage: "validating",
			workspace,
		});
		await appendActivationAuditEntry(ctx as MutationCtx, {
			actorAuthId: args.actorAuthId,
			activationAttemptId,
			eventType: "velocity_activation_stage_changed",
			newState: "activating",
			previousState: workspace.state,
			stage: "validating",
			workspace,
		});

		return {
			activationAttemptId,
			status: "validating" as const,
		};
	})
	.internal();

export const prepareVelocityPackageActivation = convex
	.mutation()
	.input({
		activationAttemptId: v.id("velocityActivationAttempts"),
		actorAuthId: v.string(),
	})
	.handler(async (ctx, args): Promise<PreparedVelocityActivation> => {
		const { attempt, workspace } = await loadAttemptWorkspaceAndSnapshot(
			ctx,
			args.activationAttemptId
		);
		const retryActorUserId =
			attempt.actorAuthId === args.actorAuthId
				? attempt.actorUserId
				: await requireViewerUserId(ctx, args.actorAuthId);
		if (attempt.status === "succeeded") {
			return buildPreparedActivation({
				attempt,
				canonical: await ensureVelocityCanonicalInputs(ctx, {
					now: Date.now(),
					workspace,
				}),
				workspace,
			});
		}
		assertFinalReviewMatches({
			reviewedSnapshotHash: attempt.reviewedSnapshotHash,
			reviewedSnapshotId: attempt.reviewedSnapshotId,
			workspace,
		});
		assertActivationReadiness(workspace);
		await assertNoLiveMortgageForWorkflowSource(ctx, workspace);

		const now = Date.now();
		const canonical = await ensureVelocityCanonicalInputs(ctx, {
			now,
			workspace,
		});
		const nextStatus = resolveNextActivationProviderStage(attempt);
		await ctx.db.patch(attempt._id, {
			actorAuthId: args.actorAuthId,
			actorUserId: retryActorUserId,
			bankAccountId: canonical.bankAccountId,
			failedAt: undefined,
			failureCode: undefined,
			failureMessage: undefined,
			status: nextStatus,
		});
		await appendActivationAuditEntry(ctx as MutationCtx, {
			actorAuthId: args.actorAuthId,
			activationAttemptId: attempt._id,
			eventType: "velocity_activation_stage_changed",
			newState: "activating",
			stage: nextStatus,
			workspace,
		});
		if (attempt.rotessaCustomerRef) {
			await appendActivationAuditEntry(ctx as MutationCtx, {
				actorAuthId: args.actorAuthId,
				activationAttemptId: attempt._id,
				eventType: "velocity_activation_provider_artifact_reused",
				newState: "activating",
				providerArtifactRef: attempt.rotessaCustomerRef,
				providerArtifactType: "rotessa_customer",
				stage: nextStatus,
				workspace,
			});
		}
		if (attempt.rotessaScheduleRef) {
			await appendActivationAuditEntry(ctx as MutationCtx, {
				actorAuthId: args.actorAuthId,
				activationAttemptId: attempt._id,
				eventType: "velocity_activation_provider_artifact_reused",
				newState: "activating",
				providerArtifactRef: attempt.rotessaScheduleRef,
				providerArtifactType: "rotessa_schedule",
				stage: nextStatus,
				workspace,
			});
		}

		const updatedAttempt = (await ctx.db.get(attempt._id)) ?? attempt;
		return buildPreparedActivation({
			attempt: updatedAttempt,
			canonical,
			workspace,
		});
	})
	.internal();

export const recordVelocityRotessaCustomerRef = convex
	.mutation()
	.input({
		activationAttemptId: v.id("velocityActivationAttempts"),
		customer: v.object({
			accountLast4: v.optional(v.string()),
			accountNumber: v.optional(v.string()),
			authorizationType: v.optional(v.string()),
			bankAccountType: v.optional(v.string()),
			bankName: v.optional(v.string()),
			customerType: v.optional(v.string()),
			email: v.optional(v.string()),
			externalCustomerCustomIdentifier: v.optional(v.string()),
			externalCustomerRef: v.string(),
			fullName: v.string(),
			institutionNumber: v.optional(v.string()),
			phone: v.optional(v.string()),
			transitNumber: v.optional(v.string()),
		}),
	})
	.handler(async (ctx, args) => {
		const { attempt, workspace } = await loadAttemptWorkspaceAndSnapshot(
			ctx,
			args.activationAttemptId
		);
		const canonical = await ensureVelocityCanonicalInputs(ctx, {
			now: Date.now(),
			workspace,
		});
		const now = Date.now();
		const customer = {
			...args.customer,
			schedules: [],
		} satisfies NormalizedRotessaCustomerSnapshot;
		const profile = await upsertExternalCustomerProfile(ctx, {
			customer,
			match: {
				borrowerId: canonical.primaryBorrower.borrowerId,
				matchStatus: "linked",
				orgId: workspace.orgId,
			},
			now,
			source: "origination_create",
		});
		await ctx.db.patch(attempt._id, {
			bankAccountId: profile.bankAccountId ?? canonical.bankAccountId,
			externalCustomerProfileId: profile.customerProfileId,
			rotessaCustomerRef: args.customer.externalCustomerRef,
			status: "creating_rotessa_schedule",
		});
		await appendActivationAuditEntry(ctx as MutationCtx, {
			actorAuthId: attempt.actorAuthId,
			activationAttemptId: attempt._id,
			eventType: "velocity_activation_provider_artifact_recorded",
			newState: "activating",
			providerArtifactRef: args.customer.externalCustomerRef,
			providerArtifactType: "rotessa_customer",
			stage: "creating_rotessa_schedule",
			workspace,
		});
		await appendActivationAuditEntry(ctx as MutationCtx, {
			actorAuthId: attempt.actorAuthId,
			activationAttemptId: attempt._id,
			eventType: "velocity_activation_stage_changed",
			newState: "activating",
			stage: "creating_rotessa_schedule",
			workspace,
		});
		return {
			bankAccountId: profile.bankAccountId,
			customerProfileId: profile.customerProfileId,
			rotessaCustomerRef: args.customer.externalCustomerRef,
		};
	})
	.internal();

export const recordVelocityRotessaScheduleRef = convex
	.mutation()
	.input({
		activationAttemptId: v.id("velocityActivationAttempts"),
		schedule: v.object({
			amountCents: v.number(),
			comment: v.optional(v.string()),
			externalScheduleRef: v.string(),
			frequency: v.string(),
			installments: v.optional(v.number()),
			nextProcessDate: v.optional(v.string()),
			processDate: v.string(),
			providerScheduleStatus: v.optional(v.string()),
		}),
	})
	.handler(async (ctx, args) => {
		const { attempt, workspace } = await loadAttemptWorkspaceAndSnapshot(
			ctx,
			args.activationAttemptId
		);
		await ctx.db.patch(attempt._id, {
			rotessaScheduleRef: args.schedule.externalScheduleRef,
			status: "creating_canonical_mortgage",
		});
		if (attempt.externalCustomerProfileId) {
			const schedule = {
				...args.schedule,
				originationPaymentFrequency:
					workspace.normalizedCore.mortgageRequest.fairlendPaymentFrequency ??
					undefined,
			} satisfies NormalizedRotessaScheduleSnapshot;
			await upsertExternalProviderSchedulesForCustomer(ctx, {
				bankAccountId: attempt.bankAccountId,
				borrowerId: undefined,
				customerProfileId: attempt.externalCustomerProfileId,
				now: Date.now(),
				schedules: [schedule],
				source: "origination_create",
			});
		}
		await appendActivationAuditEntry(ctx as MutationCtx, {
			actorAuthId: attempt.actorAuthId,
			activationAttemptId: attempt._id,
			eventType: "velocity_activation_provider_artifact_recorded",
			newState: "activating",
			providerArtifactRef: args.schedule.externalScheduleRef,
			providerArtifactType: "rotessa_schedule",
			stage: "creating_canonical_mortgage",
			workspace,
		});
		await appendActivationAuditEntry(ctx as MutationCtx, {
			actorAuthId: attempt.actorAuthId,
			activationAttemptId: attempt._id,
			eventType: "velocity_activation_stage_changed",
			newState: "activating",
			stage: "creating_canonical_mortgage",
			workspace,
		});
		return { rotessaScheduleRef: args.schedule.externalScheduleRef };
	})
	.internal();

export const finalizeVelocityPackageActivation = convex
	.mutation()
	.input({
		activationAttemptId: v.id("velocityActivationAttempts"),
	})
	.handler(async (ctx, args) => {
		const { attempt, snapshot, workspace } =
			await loadAttemptWorkspaceAndSnapshot(ctx, args.activationAttemptId);
		if (attempt.status === "succeeded" && attempt.mortgageId) {
			return {
				activationAttemptId: attempt._id,
				mortgageId: attempt.mortgageId,
				status: "succeeded" as const,
			};
		}
		const rotessaScheduleRef = requireValue(
			attempt.rotessaScheduleRef,
			"Velocity activation cannot finalize before Rotessa schedule creation succeeds."
		);
		assertFinalReviewMatches({
			reviewedSnapshotHash: attempt.reviewedSnapshotHash,
			reviewedSnapshotId: attempt.reviewedSnapshotId,
			workspace,
		});
		assertActivationReadiness(workspace);
		await assertNoLiveMortgageForWorkflowSource(ctx, workspace);

		const now = Date.now();
		const canonical = await ensureVelocityCanonicalInputs(ctx, {
			now,
			workspace,
		});
		const handoff = buildVelocityActivationHandoff({
			activationAttemptId: attempt._id,
			actorAuthId: attempt.actorAuthId,
			actorType: "admin",
			bankAccountId: attempt.bankAccountId ?? canonical.bankAccountId,
			borrowerLinks: canonical.borrowerLinks,
			brokerOfRecordId: canonical.brokerOfRecordId,
			reviewedSnapshot: snapshot,
			viewerUserId: attempt.actorUserId,
			workspace,
		});

		const aggregate = await activateMortgageAggregate(ctx as MutationCtx, {
			activationProvenance: {
				activationAttemptId: String(attempt._id),
				reviewedSnapshotHash: attempt.reviewedSnapshotHash,
				reviewedSnapshotId: String(attempt.reviewedSnapshotId),
				rotessaCustomerRef: attempt.rotessaCustomerRef,
				rotessaScheduleRef,
				velocityPackageWorkspaceId: String(workspace._id),
			},
			...handoff,
			now,
			stagedCaseStatus: "committing",
		});
		const planEntries = await Promise.all(
			aggregate.createdPlanEntryIds.map(async (entryId) => {
				const entry = await ctx.db.get(entryId);
				if (!entry) {
					throw new ConvexError(
						`Collection plan entry disappeared during Velocity activation: ${entryId}`
					);
				}
				return entry;
			})
		);
		const sortedPlanEntries = planEntries.sort((left, right) => {
			if (left.scheduledDate !== right.scheduledDate) {
				return left.scheduledDate - right.scheduledDate;
			}
			return String(left._id).localeCompare(String(right._id));
		});
		const firstPlanEntry = requireValue(
			sortedPlanEntries[0],
			"Velocity activation requires at least one generated collection plan entry."
		);
		const lastPlanEntry = requireValue(
			sortedPlanEntries.at(-1),
			"Velocity activation requires at least one generated collection plan entry."
		);
		const existingSchedule = await ctx.db
			.query("externalCollectionSchedules")
			.withIndex("by_activation_key", (query) =>
				query.eq("activationIdempotencyKey", attempt.idempotencyKey)
			)
			.first();
		const externalCollectionScheduleId =
			existingSchedule?._id ??
			(await ctx.db.insert("externalCollectionSchedules", {
				activationIdempotencyKey: attempt.idempotencyKey,
				activatedAt: now,
				bankAccountId: attempt.bankAccountId ?? canonical.bankAccountId,
				borrowerId:
					aggregate.primaryBorrowerId ?? canonical.primaryBorrower.borrowerId,
				cadence: mapMortgageFrequencyToRotessaFrequency(
					handoff.mortgageDraft.paymentFrequency
				),
				consecutiveSyncFailures: 0,
				coveredFromPlanEntryId: firstPlanEntry._id,
				coveredToPlanEntryId: lastPlanEntry._id,
				createdAt: now,
				endDate: lastPlanEntry.scheduledDate,
				externalScheduleRef: rotessaScheduleRef,
				lastProviderScheduleStatus: "active",
				lastTransitionAt: now,
				mortgageId: aggregate.mortgageId,
				nextPollAt: now,
				providerCode: "pad_rotessa",
				source: "velocity_activation",
				startDate: firstPlanEntry.scheduledDate,
				status: "active",
			}));
		if (existingSchedule) {
			await ctx.db.patch(existingSchedule._id, {
				activatedAt: existingSchedule.activatedAt ?? now,
				bankAccountId: attempt.bankAccountId ?? canonical.bankAccountId,
				borrowerId:
					aggregate.primaryBorrowerId ?? canonical.primaryBorrower.borrowerId,
				coveredFromPlanEntryId: firstPlanEntry._id,
				coveredToPlanEntryId: lastPlanEntry._id,
				endDate: lastPlanEntry.scheduledDate,
				externalScheduleRef: rotessaScheduleRef,
				lastProviderScheduleStatus: "active",
				lastTransitionAt: now,
				mortgageId: aggregate.mortgageId,
				nextPollAt: now,
				startDate: firstPlanEntry.scheduledDate,
				status: "active",
			});
		}

		for (const [index, entry] of sortedPlanEntries.entries()) {
			await ctx.db.patch(entry._id, {
				executionMode: "provider_managed",
				externalCollectionScheduleId,
				externalOccurrenceOrdinal: index + 1,
				externallyManagedAt: now,
				method: "pad_rotessa",
				status: "provider_scheduled",
			});
		}
		await ctx.db.patch(aggregate.mortgageId, {
			activeExternalCollectionScheduleId: externalCollectionScheduleId,
			collectionExecutionMode: "provider_managed",
			collectionExecutionProviderCode: "pad_rotessa",
			collectionExecutionUpdatedAt: now,
		});

		if (attempt.externalCustomerProfileId) {
			await upsertExternalProviderSchedulesForCustomer(ctx, {
				bankAccountId: attempt.bankAccountId ?? canonical.bankAccountId,
				borrowerId:
					aggregate.primaryBorrowerId ?? canonical.primaryBorrower.borrowerId,
				customerProfileId: attempt.externalCustomerProfileId,
				linkedExternalCollectionScheduleId: externalCollectionScheduleId,
				linkedMortgageId: aggregate.mortgageId,
				now,
				schedules: [
					{
						amountCents: handoff.mortgageDraft.paymentAmount,
						comment: `${VELOCITY_WORKFLOW_SOURCE_TYPE}:${workspace.linkApplicationId}`,
						externalScheduleRef: rotessaScheduleRef,
						frequency: mapMortgageFrequencyToRotessaFrequency(
							handoff.mortgageDraft.paymentFrequency
						),
						installments: sortedPlanEntries.length,
						originationPaymentFrequency: handoff.mortgageDraft.paymentFrequency,
						processDate: handoff.mortgageDraft.firstPaymentDate,
						providerScheduleStatus: "active",
					},
				],
				source: "origination_create",
			});
		}

		await ctx.db.patch(attempt._id, {
			completedAt: now,
			externalCollectionScheduleId,
			failedAt: undefined,
			failureCode: undefined,
			failureMessage: undefined,
			listingId: aggregate.listingId ?? undefined,
			mortgageId: aggregate.mortgageId,
			status: "succeeded",
		});
		await ctx.db.patch(workspace._id, {
			activation: {
				activatedAt: now,
				activatedByUserId: attempt.actorUserId,
				activationAttemptId: attempt._id,
				listingId: aggregate.listingId ?? undefined,
				mortgageId: aggregate.mortgageId,
			},
			exceptionKind: undefined,
			exceptionSummary: undefined,
			state: "activated",
			updatedAt: now,
		});
		const openActivationExceptions = (
			await ctx.db
				.query("velocityPackageExceptions")
				.withIndex("by_workspace_status", (query) =>
					query.eq("workspaceId", workspace._id).eq("status", "open")
				)
				.collect()
		).filter((exception) => exception.kind === "activation_exception");
		await Promise.all(
			openActivationExceptions.map((exception) =>
				ctx.db.patch(exception._id, {
					resolvedAt: now,
					status: "superseded",
				})
			)
		);
		await appendActivationAuditEntry(ctx as MutationCtx, {
			actorAuthId: attempt.actorAuthId,
			activationAttemptId: attempt._id,
			eventType: "velocity_activation_succeeded",
			linkedRecordIds: {
				externalCollectionScheduleId: String(externalCollectionScheduleId),
				listingId: aggregate.listingId
					? String(aggregate.listingId)
					: undefined,
				mortgageId: String(aggregate.mortgageId),
				rotessaCustomerRef: attempt.rotessaCustomerRef,
				rotessaScheduleRef,
			},
			newState: "activated",
			payloadExtras: {
				externalCollectionScheduleId: String(externalCollectionScheduleId),
				listingId: aggregate.listingId
					? String(aggregate.listingId)
					: undefined,
				mortgageId: String(aggregate.mortgageId),
				rotessaCustomerRef: attempt.rotessaCustomerRef,
				rotessaScheduleRef,
			},
			previousState: workspace.state,
			stage: "succeeded",
			workspace,
		});

		return {
			activationAttemptId: attempt._id,
			mortgageId: aggregate.mortgageId,
			status: "succeeded" as const,
		};
	})
	.internal();

export const failVelocityPackageActivation = convex
	.mutation()
	.input({
		activationAttemptId: v.id("velocityActivationAttempts"),
		compensatedRotessaScheduleRef: v.optional(v.string()),
		failureDetails: v.optional(v.record(v.string(), v.any())),
		failureCode: v.string(),
		failureMessage: v.string(),
	})
	.handler(async (ctx, args) => {
		const { attempt, workspace } = await loadAttemptWorkspaceAndSnapshot(
			ctx,
			args.activationAttemptId
		);
		if (attempt.status === "succeeded") {
			return { status: "failed" as const };
		}
		const now = Date.now();
		await ctx.db.patch(attempt._id, {
			failedAt: now,
			failureCode: args.failureCode,
			failureMessage: args.failureMessage,
			rotessaScheduleRef: args.compensatedRotessaScheduleRef
				? undefined
				: attempt.rotessaScheduleRef,
			status: "failed",
		});
		await ctx.db.patch(workspace._id, {
			exceptionKind: "activation_exception",
			exceptionSummary: args.failureMessage,
			state: "activation_failed_remediation",
			updatedAt: now,
		});
		await ctx.db.insert("velocityPackageExceptions", {
			details: {
				activationAttemptId: String(attempt._id),
				compensatedRotessaScheduleRef: args.compensatedRotessaScheduleRef,
				failureCode: args.failureCode,
				...(args.failureDetails ?? {}),
			},
			kind: "activation_exception",
			message: args.failureMessage,
			openedAt: now,
			severity: "blocking",
			sourceActivationAttemptId: attempt._id,
			status: "open",
			title: "Velocity activation failed",
			workspaceId: workspace._id,
		});
		await appendActivationAuditEntry(ctx as MutationCtx, {
			actorAuthId: attempt.actorAuthId,
			activationAttemptId: attempt._id,
			eventType: "velocity_activation_failed",
			failureMessage: args.failureMessage,
			newState: "activation_failed_remediation",
			previousState: workspace.state,
			stage: "failed",
			workspace,
		});
		return { status: "failed" as const };
	})
	.internal();

export const activateVelocityPackage = adminAction
	.input({
		reviewedSnapshotHash: v.string(),
		reviewedSnapshotId: v.id("velocityPackageSnapshots"),
		workspaceId: v.id("velocityPackageWorkspaces"),
	})
	.handler(async (ctx, args) => {
		const started = await ctx.runMutation(startVelocityPackageActivationRef, {
			...args,
			actorAuthId: ctx.viewer.authId,
		});
		if (started.status === "succeeded" && started.mortgageId) {
			return started;
		}

		let prepared = await ctx.runMutation(prepareVelocityPackageActivationRef, {
			activationAttemptId: started.activationAttemptId,
			actorAuthId: ctx.viewer.authId,
		});

		try {
			const client = createRotessaClient({ timeoutMs: 30_000 });
			if (!prepared.rotessaCustomerRef) {
				const createdCustomer = await resolveOrCreateRotessaCustomer(
					client,
					prepared
				);
				const recorded = await ctx.runMutation(
					recordVelocityRotessaCustomerRefRef,
					{
						activationAttemptId: prepared.activationAttemptId,
						customer: {
							accountLast4:
								createdCustomer.account_number?.slice(-4) ??
								prepared.bankAccount.accountNumber.slice(-4),
							accountNumber: createdCustomer.account_number ?? undefined,
							authorizationType:
								createdCustomer.authorization_type ?? undefined,
							bankAccountType: createdCustomer.bank_account_type ?? undefined,
							bankName: createdCustomer.bank_name ?? undefined,
							customerType: createdCustomer.customer_type ?? undefined,
							email: createdCustomer.email ?? prepared.customerEmail,
							externalCustomerCustomIdentifier:
								createdCustomer.custom_identifier ??
								prepared.customerCustomIdentifier,
							externalCustomerRef: String(createdCustomer.id),
							fullName: createdCustomer.name ?? prepared.customerName,
							institutionNumber:
								createdCustomer.institution_number ??
								prepared.bankAccount.institutionNumber,
							phone:
								createdCustomer.phone ??
								createdCustomer.home_phone ??
								prepared.customerPhone,
							transitNumber:
								createdCustomer.transit_number ??
								prepared.bankAccount.transitNumber,
						},
					}
				);
				prepared = {
					...prepared,
					bankAccountId: recorded.bankAccountId ?? prepared.bankAccountId,
					rotessaCustomerRef: recorded.rotessaCustomerRef,
				};
			}

			if (!prepared.rotessaScheduleRef) {
				const createdSchedule = await resolveOrCreateRotessaSchedule(
					client,
					prepared
				);
				const recorded = await ctx.runMutation(
					recordVelocityRotessaScheduleRefRef,
					{
						activationAttemptId: prepared.activationAttemptId,
						schedule: {
							amountCents: prepared.amountCents,
							comment: createdSchedule.comment ?? prepared.scheduleComment,
							externalScheduleRef: String(createdSchedule.id),
							frequency: createdSchedule.frequency,
							installments:
								createdSchedule.installments ?? prepared.installments,
							nextProcessDate: createdSchedule.next_process_date ?? undefined,
							processDate:
								createdSchedule.process_date ?? prepared.firstPaymentDate,
							providerScheduleStatus: "active",
						},
					}
				);
				prepared = {
					...prepared,
					rotessaScheduleRef: recorded.rotessaScheduleRef,
				};
			}

			return await ctx.runMutation(finalizeVelocityPackageActivationRef, {
				activationAttemptId: prepared.activationAttemptId,
			});
		} catch (error) {
			const client = createRotessaClient({ timeoutMs: 30_000 });
			const compensation = prepared.rotessaScheduleRef
				? await compensateRotessaSchedule(client, prepared.rotessaScheduleRef)
				: {};
			const compensationMessage = compensation.compensatedRotessaScheduleRef
				? ` Provider schedule ${compensation.compensatedRotessaScheduleRef} was compensated.`
				: "";
			await ctx.runMutation(failVelocityPackageActivationRef, {
				activationAttemptId: prepared.activationAttemptId,
				compensatedRotessaScheduleRef:
					compensation.compensatedRotessaScheduleRef,
				failureDetails: {
					...formatProviderFailureDetails(error),
					...(compensation.failureDetails ?? {}),
				},
				failureCode:
					error instanceof RotessaApiError ||
					error instanceof RotessaRequestError
						? "rotessa_request_failed"
						: "velocity_activation_failed",
				failureMessage: `${formatActivationError(error)}${compensationMessage}`,
			});
			throw error;
		}
	})
	.public();
