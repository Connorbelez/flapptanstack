import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { adminMutation, adminQuery } from "../fluent";
import { appendVelocityPackageAuditEntry } from "./audit";
import type {
	VelocityPackageDocumentRole,
	VelocityPackageExceptionKind,
	VelocityPackageWorkspaceState,
} from "./constants";
import type {
	VelocityFairLendEnrichmentV1,
	VelocityLoanType,
	VelocityPackageAuditPayload,
	VelocityReadinessV1,
} from "./contracts";
import {
	computeVelocityReadiness,
	resolveVelocityWorkspaceState,
} from "./sync";
import {
	velocityLoanTypeValidator,
	velocityPackageExceptionKindValidator,
	velocityPackageWorkspaceStateValidator,
} from "./validators";

type VelocityWorkspace = Doc<"velocityPackageWorkspaces">;
type DocumentAsset = Doc<"documentAssets">;

const optionalString = v.optional(v.string());
const optionalNumber = v.optional(v.number());
const optionalBoolean = v.optional(v.boolean());
const nullableNumber = v.union(v.number(), v.null());

const bankInputPatchValidator = v.object({
	accountHolderName: optionalString,
	accountLast4: optionalString,
	accountNumber: optionalString,
	country: v.optional(v.literal("CA")),
	currency: v.optional(v.literal("CAD")),
	institutionNumber: optionalString,
	transitNumber: optionalString,
});

const listingOverridesPatchValidator = v.object({
	adminNotes: optionalString,
	description: optionalString,
	displayOrder: optionalNumber,
	featured: optionalBoolean,
	heroImages: v.optional(
		v.array(
			v.object({
				caption: optionalString,
				storageId: v.id("_storage"),
			})
		)
	),
	marketplaceCopy: optionalString,
	seoSlug: optionalString,
	title: optionalString,
});

const valuationPatchValidator = v.object({
	comparables: v.optional(v.array(v.record(v.string(), v.any()))),
	relatedDocumentAssetId: v.optional(v.id("documentAssets")),
	valuationDate: optionalString,
	valueAsIs: v.optional(nullableNumber),
});

const activationRemediationPatchValidator = v.object({
	assignedBrokerId: v.optional(v.id("brokers")),
	borrowerRoleOverrides: v.optional(
		v.array(
			v.object({
				borrowerExternalKey: v.string(),
				role: v.union(
					v.literal("primary"),
					v.literal("co_borrower"),
					v.literal("guarantor")
				),
			})
		)
	),
	brokerOfRecordId: v.optional(v.id("brokers")),
	lienPosition: v.optional(nullableNumber),
	loanType: v.optional(v.union(velocityLoanTypeValidator, v.null())),
	notes: optionalString,
	policyInputs: v.optional(v.record(v.string(), v.any())),
});

const fairlendEnrichmentPatchValidator = v.object({
	activationRemediation: v.optional(activationRemediationPatchValidator),
	bankInput: v.optional(bankInputPatchValidator),
	listingOverrides: v.optional(listingOverridesPatchValidator),
	staffNotes: optionalString,
	valuation: v.optional(valuationPatchValidator),
});

interface VelocityActivationRemediationPatch
	extends Omit<
		NonNullable<VelocityFairLendEnrichmentV1["activationRemediation"]>,
		"lienPosition" | "loanType"
	> {
	lienPosition?: number | null;
	loanType?: VelocityLoanType | null;
}

interface VelocityValuationPatch
	extends Omit<
		NonNullable<VelocityFairLendEnrichmentV1["valuation"]>,
		"valueAsIs"
	> {
	valueAsIs?: number | null;
}

interface FairLendEnrichmentPatch {
	activationRemediation?: VelocityActivationRemediationPatch;
	bankInput?: Partial<NonNullable<VelocityFairLendEnrichmentV1["bankInput"]>>;
	listingOverrides?: VelocityFairLendEnrichmentV1["listingOverrides"];
	staffNotes?: string;
	valuation?: VelocityValuationPatch;
}

function requireWorkspace(
	workspace: VelocityWorkspace | null
): VelocityWorkspace {
	if (!workspace) {
		throw new ConvexError("Velocity package workspace not found");
	}
	return workspace;
}

async function requireViewerUserId(
	ctx: Pick<QueryCtx | MutationCtx, "db"> & { viewer: { authId: string } }
) {
	const user = await ctx.db
		.query("users")
		.withIndex("authId", (query) => query.eq("authId", ctx.viewer.authId))
		.unique();
	if (!user) {
		throw new ConvexError("User not found in database");
	}
	return user._id;
}

function accountLast4(accountNumber?: string) {
	const digits = accountNumber?.replace(/\D/g, "");
	return digits && digits.length >= 4 ? digits.slice(-4) : undefined;
}

function deriveAccountLast4(args: {
	nextBankInput?: VelocityFairLendEnrichmentV1["bankInput"];
	patchBankInput?: Partial<
		NonNullable<VelocityFairLendEnrichmentV1["bankInput"]>
	>;
}) {
	if (args.patchBankInput?.accountNumber !== undefined) {
		return accountLast4(args.patchBankInput.accountNumber);
	}
	return (
		args.patchBankInput?.accountLast4 ??
		args.nextBankInput?.accountLast4 ??
		accountLast4(args.nextBankInput?.accountNumber)
	);
}

function mergeFairLendEnrichment(
	current: VelocityFairLendEnrichmentV1,
	patch: FairLendEnrichmentPatch
): VelocityFairLendEnrichmentV1 {
	const nextActivationRemediation = patch.activationRemediation
		? mergeActivationRemediation(
				current.activationRemediation,
				patch.activationRemediation
			)
		: current.activationRemediation;

	const nextBankInput = patch.bankInput
		? {
				...(current.bankInput ?? {
					country: "CA" as const,
					currency: "CAD" as const,
				}),
				...patch.bankInput,
				country: "CA" as const,
				currency: "CAD" as const,
			}
		: current.bankInput;
	const derivedLast4 = deriveAccountLast4({
		nextBankInput,
		patchBankInput: patch.bankInput,
	});
	const nextValuation = patch.valuation
		? mergeValuation(current.valuation, patch.valuation)
		: current.valuation;

	return {
		...current,
		activationRemediation: nextActivationRemediation,
		bankInput: nextBankInput
			? {
					...nextBankInput,
					accountLast4: derivedLast4,
				}
			: undefined,
		listingOverrides: patch.listingOverrides
			? {
					...(current.listingOverrides ?? {}),
					...patch.listingOverrides,
				}
			: current.listingOverrides,
		padEvidence: current.padEvidence,
		staffNotes: patch.staffNotes ?? current.staffNotes,
		valuation: nextValuation,
	};
}

function mergeActivationRemediation(
	current: VelocityFairLendEnrichmentV1["activationRemediation"],
	patch: VelocityActivationRemediationPatch
): VelocityFairLendEnrichmentV1["activationRemediation"] {
	const clearedCurrent = clearActivationFields(current, patch);
	const { lienPosition, loanType, ...patchWithoutClearableFields } = patch;
	const merged = {
		...clearedCurrent,
		...patchWithoutClearableFields,
		...(lienPosition == null ? {} : { lienPosition }),
		...(loanType == null ? {} : { loanType }),
		policyInputs: {
			...(current?.policyInputs ?? {}),
			...(patch.policyInputs ?? {}),
		},
	};

	return merged;
}

function mergeValuation(
	current: VelocityFairLendEnrichmentV1["valuation"],
	patch: VelocityValuationPatch
): VelocityFairLendEnrichmentV1["valuation"] {
	const clearedCurrent = clearValuationFields(current, patch);
	const { valueAsIs, ...patchWithoutClearableFields } = patch;
	const merged = {
		...clearedCurrent,
		...patchWithoutClearableFields,
		...(valueAsIs == null ? {} : { valueAsIs }),
	};

	return merged;
}

function clearActivationFields(
	current: VelocityFairLendEnrichmentV1["activationRemediation"],
	patch: VelocityActivationRemediationPatch
): Partial<NonNullable<VelocityFairLendEnrichmentV1["activationRemediation"]>> {
	const currentFields = current ?? {};
	const withoutLienPosition =
		patch.lienPosition === null
			? (({ lienPosition: _lienPosition, ...rest }) => rest)(currentFields)
			: currentFields;

	return patch.loanType === null
		? (({ loanType: _loanType, ...rest }) => rest)(withoutLienPosition)
		: withoutLienPosition;
}

function clearValuationFields(
	current: VelocityFairLendEnrichmentV1["valuation"],
	patch: VelocityValuationPatch
): Partial<NonNullable<VelocityFairLendEnrichmentV1["valuation"]>> {
	const currentFields = current ?? {};

	return patch.valueAsIs === null
		? (({ valueAsIs: _valueAsIs, ...rest }) => rest)(currentFields)
		: currentFields;
}

async function latestOpenExceptionSummary(
	ctx: Pick<QueryCtx | MutationCtx, "db">,
	workspaceId: Id<"velocityPackageWorkspaces">
) {
	const exception = await ctx.db
		.query("velocityPackageExceptions")
		.withIndex("by_workspace_status", (query) =>
			query.eq("workspaceId", workspaceId).eq("status", "open")
		)
		.order("desc")
		.first();

	return {
		exceptionKind: exception?.kind,
		exceptionSummary: exception?.title ?? exception?.message,
	};
}

async function workspaceIdsWithOpenExceptionKind(
	ctx: Pick<QueryCtx | MutationCtx, "db">,
	exceptionKind: VelocityPackageExceptionKind
) {
	const exceptions = await ctx.db
		.query("velocityPackageExceptions")
		.withIndex("by_kind_status", (query) =>
			query.eq("kind", exceptionKind).eq("status", "open")
		)
		.collect();

	return new Set(
		exceptions
			.map((exception) => exception.workspaceId)
			.filter(
				(workspaceId): workspaceId is Id<"velocityPackageWorkspaces"> =>
					workspaceId !== undefined
			)
	);
}

async function loadWorkspaceRecords(args: {
	ctx: Pick<QueryCtx | MutationCtx, "db">;
	exceptionWorkspaceIds: Set<Id<"velocityPackageWorkspaces">> | null;
	state?: VelocityPackageWorkspaceState;
}) {
	if (args.state) {
		return await args.ctx.db
			.query("velocityPackageWorkspaces")
			.withIndex("by_state_updated_at", (query) =>
				query.eq("state", args.state as VelocityPackageWorkspaceState)
			)
			.order("desc")
			.collect();
	}

	if (args.exceptionWorkspaceIds) {
		const records = await Promise.all(
			[...args.exceptionWorkspaceIds].map((workspaceId) =>
				args.ctx.db.get(workspaceId)
			)
		);
		return records
			.filter((workspace): workspace is VelocityWorkspace => workspace !== null)
			.sort((left, right) => right.updatedAt - left.updatedAt);
	}

	return await args.ctx.db
		.query("velocityPackageWorkspaces")
		.order("desc")
		.collect();
}

async function recomputeWorkspaceReadiness(
	ctx: Pick<MutationCtx, "db">,
	args: {
		enrichment: VelocityFairLendEnrichmentV1;
		workspace: VelocityWorkspace;
	}
) {
	const readiness = computeVelocityReadiness({
		core: args.workspace.normalizedCore,
		enrichment: args.enrichment,
		workspace: {
			...args.workspace,
			fairlendEnrichment: args.enrichment,
		},
	});
	const state = resolveVelocityWorkspaceState({
		readiness,
		workspace: args.workspace,
	});
	const latestException = await latestOpenExceptionSummary(
		ctx,
		args.workspace._id
	);

	return {
		...latestException,
		readiness,
		state,
	};
}

async function appendStaffAuditEntry(
	ctx: MutationCtx,
	viewer: {
		authId: string;
		orgId?: string;
	},
	args: {
		eventType:
			| "velocity_document_linked"
			| "velocity_exception_resolved"
			| "velocity_fairlend_enrichment_updated"
			| "velocity_final_review_confirmed"
			| "velocity_readiness_recomputed";
		payload?: VelocityPackageAuditPayload;
		previousState?: VelocityPackageWorkspaceState;
		readiness?: VelocityReadinessV1;
		workspace: VelocityWorkspace;
	}
) {
	await appendVelocityPackageAuditEntry(ctx, {
		actorId: viewer.authId,
		actorType: "admin",
		channel: "admin_dashboard",
		eventType: args.eventType,
		newState: args.payload?.state as string | undefined,
		organizationId: viewer.orgId,
		payload: args.payload,
		previousState: args.previousState,
		readiness: args.readiness,
		workspaceId: args.workspace._id,
	});
}

function propertyAddress(workspace: VelocityWorkspace) {
	const property = workspace.normalizedCore.subjectProperty;
	return [
		property.unit ? `Unit ${property.unit}` : undefined,
		property.streetNumber,
		property.streetName,
		property.city,
		property.province,
		property.postalCode,
	]
		.filter(Boolean)
		.join(", ");
}

async function boardRow(
	ctx: Pick<QueryCtx | MutationCtx, "db">,
	workspace: VelocityWorkspace
) {
	const latestException = await latestOpenExceptionSummary(ctx, workspace._id);
	return {
		workspaceId: workspace._id,
		linkApplicationId: workspace.linkApplicationId,
		loanCode: workspace.loanCode,
		lenderReferenceNumber: workspace.lenderReferenceNumber,
		currentVelocityStage: {
			code: workspace.currentVelocityStatusCode ?? null,
			label: workspace.currentVelocityStatusLabel ?? null,
		},
		fairlendActionState: workspace.state,
		readiness: {
			canActivate: workspace.readiness.canActivate,
			canFinalReview: workspace.readiness.canFinalReview,
			blockerCount: workspace.readiness.blockers.length,
			blockers: workspace.readiness.blockers,
			warnings: workspace.readiness.warnings,
		},
		exception: {
			hasOpenException: Boolean(latestException.exceptionKind),
			kind: latestException.exceptionKind ?? workspace.exceptionKind ?? null,
			summary:
				latestException.exceptionSummary ?? workspace.exceptionSummary ?? null,
		},
		primaryBorrowerName:
			workspace.normalizedCore.borrowers[0]?.fullName ?? "Unknown borrower",
		propertyAddress: propertyAddress(workspace) || null,
		requestedPrincipal:
			workspace.normalizedCore.mortgageRequest.requestedPrincipal ?? null,
		updatedAt: workspace.updatedAt,
	};
}

async function documentLinkDetail(
	ctx: Pick<QueryCtx | MutationCtx, "db">,
	link: Doc<"velocityPackageDocumentLinks">
) {
	const asset = await ctx.db.get(link.documentAssetId);
	return {
		documentAsset: asset
			? {
					assetId: asset._id,
					fileHash: asset.fileHash,
					mimeType: asset.mimeType,
					name: asset.name,
					originalFilename: asset.originalFilename,
					uploadedAt: asset.uploadedAt,
					uploadedByUserId: asset.uploadedByUserId,
				}
			: null,
		documentAssetId: link.documentAssetId,
		linkedAt: link.linkedAt,
		linkedByUserId: link.linkedByUserId,
		linkId: link._id,
		role: link.role,
		supersededAt: link.supersededAt ?? null,
	};
}

function activationAttemptDetail(
	attempt: Doc<"velocityActivationAttempts"> | null
) {
	if (!attempt) {
		return null;
	}

	return {
		activationAttemptId: attempt._id,
		bankAccountId: attempt.bankAccountId ?? null,
		completedAt: attempt.completedAt ?? null,
		externalCollectionScheduleId: attempt.externalCollectionScheduleId ?? null,
		externalCustomerProfileId: attempt.externalCustomerProfileId ?? null,
		failedAt: attempt.failedAt ?? null,
		failureCode: attempt.failureCode ?? null,
		failureMessage: attempt.failureMessage ?? null,
		idempotencyKey: attempt.idempotencyKey,
		listingId: attempt.listingId ?? null,
		mortgageId: attempt.mortgageId ?? null,
		reviewedSnapshotHash: attempt.reviewedSnapshotHash,
		reviewedSnapshotId: attempt.reviewedSnapshotId,
		rotessaCustomerRef: attempt.rotessaCustomerRef ?? null,
		rotessaScheduleRef: attempt.rotessaScheduleRef ?? null,
		startedAt: attempt.startedAt,
		status: attempt.status,
	};
}

function fairlendEnrichmentDetail(
	enrichment: VelocityFairLendEnrichmentV1
): VelocityFairLendEnrichmentV1 {
	if (!enrichment.bankInput) {
		return {
			...enrichment,
			bankInput: undefined,
		};
	}

	const { accountNumber: _accountNumber, ...bankInput } = enrichment.bankInput;
	return {
		...enrichment,
		bankInput,
	};
}

async function workspaceDetail(
	ctx: Pick<QueryCtx | MutationCtx, "db">,
	workspace: VelocityWorkspace
) {
	const [documentLinks, exceptions, latestActivationAttempt, snapshots] =
		await Promise.all([
			ctx.db
				.query("velocityPackageDocumentLinks")
				.withIndex("by_workspace_role", (query) =>
					query.eq("workspaceId", workspace._id)
				)
				.collect(),
			ctx.db
				.query("velocityPackageExceptions")
				.filter((query) => query.eq(query.field("workspaceId"), workspace._id))
				.collect(),
			ctx.db
				.query("velocityActivationAttempts")
				.withIndex("by_workspace_started_at", (query) =>
					query.eq("workspaceId", workspace._id)
				)
				.order("desc")
				.first(),
			ctx.db
				.query("velocityPackageSnapshots")
				.withIndex("by_workspace_created_at", (query) =>
					query.eq("workspaceId", workspace._id)
				)
				.order("desc")
				.collect(),
		]);

	return {
		workspaceId: workspace._id,
		activation: workspace.activation ?? null,
		activationAttempt: activationAttemptDetail(latestActivationAttempt),
		auditSubject: {
			entityId: String(workspace._id),
			entityType: "velocityPackageWorkspace" as const,
		},
		documents: await Promise.all(
			documentLinks.map((link) => documentLinkDetail(ctx, link))
		),
		exceptions: exceptions
			.sort((left, right) => right.openedAt - left.openedAt)
			.map((exception) => ({
				exceptionId: exception._id,
				kind: exception.kind,
				message: exception.message,
				openedAt: exception.openedAt,
				resolvedAt: exception.resolvedAt ?? null,
				resolvedByUserId: exception.resolvedByUserId ?? null,
				severity: exception.severity,
				status: exception.status,
				title: exception.title,
			})),
		fairlendOwned: {
			enrichment: fairlendEnrichmentDetail(workspace.fairlendEnrichment),
			finalReview: workspace.finalReview ?? null,
			state: workspace.state,
		},
		readiness: workspace.readiness,
		snapshots: snapshots.map((snapshot) => ({
			createdAt: snapshot.createdAt,
			createdBy: snapshot.createdBy,
			normalizedCoreHash: snapshot.normalizedCoreHash,
			rawDealHash: snapshot.rawDealHash,
			snapshotId: snapshot._id,
			snapshotType: snapshot.snapshotType,
		})),
		velocityOwned: {
			borrowers: workspace.normalizedCore.borrowers,
			conditions: workspace.normalizedCore.conditions,
			identity: workspace.normalizedCore.identity,
			lenderConditions: workspace.normalizedCore.lenderConditions,
			mortgageRequest: workspace.normalizedCore.mortgageRequest,
			normalizedCoreHash: workspace.normalizedCoreHash,
			notes: workspace.normalizedCore.notes,
			referral: workspace.normalizedCore.referral ?? null,
			solicitor: workspace.normalizedCore.solicitor ?? null,
			sourceVersion: workspace.normalizedCore.sourceVersion,
			subjectProperty: workspace.normalizedCore.subjectProperty,
			upstream: workspace.normalizedCore.upstream,
		},
	};
}

async function requireDocumentAsset(
	ctx: Pick<QueryCtx | MutationCtx, "db">,
	documentAssetId: Id<"documentAssets">
): Promise<DocumentAsset> {
	const asset = await ctx.db.get(documentAssetId);
	if (!asset) {
		throw new ConvexError("Document asset not found");
	}
	if (asset.mimeType !== "application/pdf") {
		throw new ConvexError(
			"Velocity package documents must reference PDF assets"
		);
	}
	return asset;
}

export const listVelocityPackageWorkspaces = adminQuery
	.input({
		exceptionKind: v.optional(velocityPackageExceptionKindValidator),
		state: v.optional(velocityPackageWorkspaceStateValidator),
	})
	.handler(async (ctx, args) => {
		const exceptionWorkspaceIds = args.exceptionKind
			? await workspaceIdsWithOpenExceptionKind(
					ctx,
					args.exceptionKind as VelocityPackageExceptionKind
				)
			: null;
		const records = await loadWorkspaceRecords({
			ctx,
			exceptionWorkspaceIds,
			state: args.state as VelocityPackageWorkspaceState | undefined,
		});

		const filtered = exceptionWorkspaceIds
			? records.filter((record) => exceptionWorkspaceIds.has(record._id))
			: records;

		return Promise.all(filtered.map((workspace) => boardRow(ctx, workspace)));
	})
	.public();

export const getVelocityPackageWorkspace = adminQuery
	.input({
		workspaceId: v.id("velocityPackageWorkspaces"),
	})
	.handler(async (ctx, args) => {
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			return null;
		}

		return workspaceDetail(ctx, workspace);
	})
	.public();

export const updateVelocityPackageFairLendFields = adminMutation
	.input({
		patch: fairlendEnrichmentPatchValidator,
		workspaceId: v.id("velocityPackageWorkspaces"),
	})
	.handler(async (ctx, args) => {
		const workspace = requireWorkspace(await ctx.db.get(args.workspaceId));
		if (args.patch.valuation?.relatedDocumentAssetId) {
			await requireDocumentAsset(
				ctx,
				args.patch.valuation.relatedDocumentAssetId
			);
		}

		const enrichment = mergeFairLendEnrichment(
			workspace.fairlendEnrichment,
			args.patch
		);
		const recomputed = await recomputeWorkspaceReadiness(ctx, {
			enrichment,
			workspace,
		});
		const now = Date.now();

		await ctx.db.patch(workspace._id, {
			exceptionKind: recomputed.exceptionKind,
			exceptionSummary: recomputed.exceptionSummary,
			fairlendEnrichment: enrichment,
			readiness: recomputed.readiness,
			state: recomputed.state,
			updatedAt: now,
		});

		const payload = {
			linkApplicationId: workspace.linkApplicationId,
			loanCode: workspace.loanCode,
			normalizedCoreHash: workspace.normalizedCoreHash,
			state: recomputed.state,
			workspaceId: String(workspace._id),
		} satisfies VelocityPackageAuditPayload & { state: string };
		await appendStaffAuditEntry(ctx as MutationCtx, ctx.viewer, {
			eventType: "velocity_fairlend_enrichment_updated",
			payload,
			previousState: workspace.state,
			readiness: recomputed.readiness,
			workspace,
		});
		await appendStaffAuditEntry(ctx as MutationCtx, ctx.viewer, {
			eventType: "velocity_readiness_recomputed",
			payload,
			previousState: workspace.state,
			readiness: recomputed.readiness,
			workspace,
		});

		return {
			readiness: recomputed.readiness,
			state: recomputed.state,
			workspaceId: workspace._id,
		};
	})
	.public();

export async function applyVelocityPackageDocumentLink(
	ctx: MutationCtx,
	args: {
		documentAssetId: Id<"documentAssets">;
		role: VelocityPackageDocumentRole;
		workspaceId: Id<"velocityPackageWorkspaces">;
	},
	viewer: {
		authId: string;
		orgId?: string;
	}
) {
	const workspace = requireWorkspace(await ctx.db.get(args.workspaceId));
	const [asset, linkedByUserId] = await Promise.all([
		requireDocumentAsset(ctx, args.documentAssetId),
		requireViewerUserId({ ...ctx, viewer }),
	]);
	const now = Date.now();
	const activeLinks = await ctx.db
		.query("velocityPackageDocumentLinks")
		.withIndex("by_active_workspace_role", (query) =>
			query
				.eq("workspaceId", workspace._id)
				.eq("role", args.role)
				.eq("supersededAt", undefined)
		)
		.collect();

	await Promise.all(
		activeLinks.map((link) =>
			ctx.db.patch(link._id, {
				supersededAt: now,
			})
		)
	);

	const linkId = await ctx.db.insert("velocityPackageDocumentLinks", {
		documentAssetId: asset._id,
		linkedAt: now,
		linkedByUserId,
		role: args.role,
		supersededAt: undefined,
		workspaceId: workspace._id,
	});

	const enrichment =
		args.role === "pad_evidence"
			? {
					...workspace.fairlendEnrichment,
					padEvidence: {
						documentAssetId: asset._id,
						fileHash: asset.fileHash,
						mimeType: asset.mimeType,
						originalFilename: asset.originalFilename,
						uploadedAt: asset.uploadedAt,
						uploadedByUserId: asset.uploadedByUserId,
					},
				}
			: workspace.fairlendEnrichment;
	const recomputed = await recomputeWorkspaceReadiness(ctx, {
		enrichment,
		workspace,
	});

	await ctx.db.patch(workspace._id, {
		exceptionKind: recomputed.exceptionKind,
		exceptionSummary: recomputed.exceptionSummary,
		fairlendEnrichment: enrichment,
		readiness: recomputed.readiness,
		state: recomputed.state,
		updatedAt: now,
	});

	const payload = {
		documentAssetId: String(asset._id),
		linkApplicationId: workspace.linkApplicationId,
		loanCode: workspace.loanCode,
		normalizedCoreHash: workspace.normalizedCoreHash,
		role: args.role,
		state: recomputed.state,
		workspaceId: String(workspace._id),
	} satisfies VelocityPackageAuditPayload & {
		documentAssetId: string;
		role: VelocityPackageDocumentRole;
		state: string;
	};
	await appendStaffAuditEntry(ctx, viewer, {
		eventType: "velocity_document_linked",
		payload,
		previousState: workspace.state,
		readiness: recomputed.readiness,
		workspace,
	});
	await appendStaffAuditEntry(ctx, viewer, {
		eventType: "velocity_readiness_recomputed",
		payload,
		previousState: workspace.state,
		readiness: recomputed.readiness,
		workspace,
	});

	return {
		documentLinkId: linkId,
		readiness: recomputed.readiness,
		state: recomputed.state,
		workspaceId: workspace._id,
	};
}

export async function applyVelocityPackageFinalReview(
	ctx: MutationCtx,
	args: {
		normalizedCoreHash: string;
		snapshotId: Id<"velocityPackageSnapshots">;
		workspaceId: Id<"velocityPackageWorkspaces">;
	},
	viewer: {
		authId: string;
		orgId?: string;
	}
) {
	const [workspace, sourceSnapshot, reviewedByUserId] = await Promise.all([
		ctx.db.get(args.workspaceId),
		ctx.db.get(args.snapshotId),
		requireViewerUserId({ ...ctx, viewer }),
	]);
	const existingWorkspace = requireWorkspace(workspace);
	if (!sourceSnapshot || sourceSnapshot.workspaceId !== existingWorkspace._id) {
		throw new ConvexError("Velocity package snapshot not found for workspace");
	}
	if (sourceSnapshot.normalizedCoreHash !== args.normalizedCoreHash) {
		throw new ConvexError("Reviewed snapshot hash does not match request hash");
	}
	if (existingWorkspace.normalizedCoreHash !== args.normalizedCoreHash) {
		throw new ConvexError(
			"Velocity-owned core data changed before final review confirmation"
		);
	}

	const preReviewReadiness = computeVelocityReadiness({
		core: existingWorkspace.normalizedCore,
		enrichment: existingWorkspace.fairlendEnrichment,
		workspace: {
			...existingWorkspace,
			finalReview: undefined,
		},
	});
	if (!preReviewReadiness.canFinalReview) {
		throw new ConvexError(
			`Velocity package is not ready for final review: ${preReviewReadiness.blockers
				.map((blocker) => blocker.code)
				.join(", ")}`
		);
	}

	const now = Date.now();
	const finalReviewSnapshotId = await ctx.db.insert(
		"velocityPackageSnapshots",
		{
			createdAt: now,
			createdBy: "system",
			createdByUserId: reviewedByUserId,
			linkApplicationId: sourceSnapshot.linkApplicationId,
			loanCode: sourceSnapshot.loanCode,
			normalizedCore: sourceSnapshot.normalizedCore,
			normalizedCoreHash: sourceSnapshot.normalizedCoreHash,
			rawDealHash: sourceSnapshot.rawDealHash,
			rawDealJson: sourceSnapshot.rawDealJson,
			snapshotType: "final_review",
			workspaceId: existingWorkspace._id,
		}
	);
	const finalReview = {
		reviewedAt: now,
		reviewedByUserId,
		reviewedSnapshotHash: args.normalizedCoreHash,
		reviewedSnapshotId: finalReviewSnapshotId,
	};
	const workspaceWithReview = {
		...existingWorkspace,
		finalReview,
	};
	const readiness = computeVelocityReadiness({
		core: existingWorkspace.normalizedCore,
		enrichment: existingWorkspace.fairlendEnrichment,
		workspace: workspaceWithReview,
	});
	const state = resolveVelocityWorkspaceState({
		readiness,
		workspace: workspaceWithReview,
	});
	const latestException = await latestOpenExceptionSummary(
		ctx,
		existingWorkspace._id
	);

	await ctx.db.patch(existingWorkspace._id, {
		exceptionKind: latestException.exceptionKind,
		exceptionSummary: latestException.exceptionSummary,
		finalReview,
		readiness,
		state,
		updatedAt: now,
	});

	const payload = {
		linkApplicationId: existingWorkspace.linkApplicationId,
		loanCode: existingWorkspace.loanCode,
		normalizedCoreHash: existingWorkspace.normalizedCoreHash,
		reviewedSnapshotHash: args.normalizedCoreHash,
		snapshotId: String(finalReviewSnapshotId),
		state,
		workspaceId: String(existingWorkspace._id),
	} satisfies VelocityPackageAuditPayload & { state: string };
	await appendStaffAuditEntry(ctx, viewer, {
		eventType: "velocity_final_review_confirmed",
		payload,
		previousState: existingWorkspace.state,
		readiness,
		workspace: existingWorkspace,
	});
	await appendStaffAuditEntry(ctx, viewer, {
		eventType: "velocity_readiness_recomputed",
		payload,
		previousState: existingWorkspace.state,
		readiness,
		workspace: existingWorkspace,
	});

	return {
		finalReview,
		readiness,
		state,
		workspaceId: existingWorkspace._id,
	};
}

export async function applyVelocityPackageExceptionResolution(
	ctx: MutationCtx,
	args: {
		exceptionId: Id<"velocityPackageExceptions">;
		resolutionNote: string;
	},
	viewer: {
		authId: string;
		orgId?: string;
	}
) {
	const [exception, resolvedByUserId] = await Promise.all([
		ctx.db.get(args.exceptionId),
		requireViewerUserId({ ...ctx, viewer }),
	]);
	if (!exception) {
		throw new ConvexError("Velocity package exception not found");
	}
	if (exception.status === "resolved") {
		return {
			exceptionId: exception._id,
			status: exception.status,
			workspaceId: exception.workspaceId ?? null,
		};
	}

	const now = Date.now();
	await ctx.db.patch(exception._id, {
		details: {
			...(exception.details ?? {}),
			resolutionNote: args.resolutionNote,
		},
		resolvedAt: now,
		resolvedByUserId,
		status: "resolved",
	});

	const workspace = exception.workspaceId
		? await ctx.db.get(exception.workspaceId)
		: null;
	if (workspace) {
		const recomputed = await recomputeWorkspaceReadiness(ctx, {
			enrichment: workspace.fairlendEnrichment,
			workspace,
		});
		await ctx.db.patch(workspace._id, {
			exceptionKind: recomputed.exceptionKind,
			exceptionSummary: recomputed.exceptionSummary,
			readiness: recomputed.readiness,
			state: recomputed.state,
			updatedAt: now,
		});

		await appendStaffAuditEntry(ctx, viewer, {
			eventType: "velocity_exception_resolved",
			payload: {
				exceptionKind: exception.kind,
				linkApplicationId: workspace.linkApplicationId,
				loanCode: workspace.loanCode,
				state: recomputed.state,
				workspaceId: String(workspace._id),
			} satisfies VelocityPackageAuditPayload & { state: string },
			previousState: workspace.state,
			readiness: recomputed.readiness,
			workspace,
		});
	}

	return {
		exceptionId: exception._id,
		status: "resolved" as const,
		workspaceId: exception.workspaceId ?? null,
	};
}
