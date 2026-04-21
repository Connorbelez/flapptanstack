import { ConvexError, v } from "convex/values";
import {
	buildOriginationCaseLabel,
	buildOriginationCaseShortId,
	INITIAL_ORIGINATION_STEP,
} from "../../../src/lib/admin-origination";
import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import {
	adminMutation,
	authedMutation,
	authedQuery,
	convex,
	requirePermission,
} from "../../fluent";
import {
	assertOriginationCaseAccess,
	assertOriginationCaseAccessContext,
	ORIGINATION_CASE_ACCESS_REQUIRES_ORG_CONTEXT,
} from "../../authz/origination";
import {
	type AdminOriginationCasePatch,
	adminOriginationCasePatchValidator,
	computeOriginationValidationSnapshot,
	determineRecommendedOriginationStep,
	listOriginationStepErrors,
	mergeOriginationCaseDraftValues,
	type OriginationCaseDraftState,
	resolveDraftOriginationCaseStatus,
} from "./validators";

const originationQuery = authedQuery.use(
	requirePermission("mortgage:originate")
);
const originationMutation = authedMutation.use(
	requirePermission("mortgage:originate")
);
const originationAdminMutation = adminMutation.use(
	requirePermission("mortgage:originate")
);

interface OriginationCaseViewerContext {
	authId: string;
	isFairLendAdmin: boolean;
	orgId?: string | null;
}

function assertMutableOriginationCase(
	record: Pick<Doc<"adminOriginationCases">, "status">
) {
	if (record.status === "committed" || record.status === "committing") {
		throw new ConvexError(
			"Committed or in-flight origination cases are immutable. Open the canonical mortgage instead."
		);
	}
}

function requireViewerOrgId(viewer: { orgId?: string | null }) {
	if (!viewer.orgId) {
		throw new ConvexError(ORIGINATION_CASE_ACCESS_REQUIRES_ORG_CONTEXT);
	}

	return viewer.orgId;
}

function summarizeCase(
	record: Pick<
		Doc<"adminOriginationCases">,
		| "_id"
		| "collectionsDraft"
		| "createdAt"
		| "currentStep"
		| "listingOverrides"
		| "mortgageDraft"
		| "participantsDraft"
		| "propertyDraft"
		| "status"
		| "updatedAt"
		| "validationSnapshot"
		| "valuationDraft"
	>
) {
	const recommendedStep = determineRecommendedOriginationStep({
		currentStep: record.currentStep,
		participantsDraft: record.participantsDraft,
		propertyDraft: record.propertyDraft,
		valuationDraft: record.valuationDraft,
		mortgageDraft: record.mortgageDraft,
		collectionsDraft: record.collectionsDraft,
		listingOverrides: record.listingOverrides,
		validationSnapshot: record.validationSnapshot,
	});

	return {
		caseId: record._id,
		caseShortId: buildOriginationCaseShortId(record._id),
		label: buildOriginationCaseLabel({
			caseId: record._id,
			participantsDraft: record.participantsDraft,
			propertyDraft: record.propertyDraft,
		}),
		currentStep: record.currentStep ?? recommendedStep,
		primaryBorrowerName: record.participantsDraft?.primaryBorrower?.fullName,
		propertyAddress: record.propertyDraft?.create?.streetAddress,
		principal: record.mortgageDraft?.principal,
		status: record.status,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
		hasValidationErrors: Object.values(
			record.validationSnapshot?.stepErrors ?? {}
		).some((errors) => errors.length > 0),
	};
}

async function requireViewerUser(ctx: Pick<MutationCtx, "db">, authId: string) {
	const user = await ctx.db
		.query("users")
		.withIndex("authId", (query) => query.eq("authId", authId))
		.unique();
	if (!user) {
		throw new ConvexError("User not found in database");
	}

	return user;
}

async function createOriginationCaseRecord(
	ctx: Pick<MutationCtx, "db">,
	args: {
		bootstrapToken?: string;
		viewer: OriginationCaseViewerContext;
	}
) {
	const now = Date.now();
	const orgId = args.viewer.isFairLendAdmin
		? (args.viewer.orgId ?? undefined)
		: requireViewerOrgId(args.viewer);
	const user = await requireViewerUser(ctx, args.viewer.authId);

	if (args.bootstrapToken) {
		const existing = await ctx.db
			.query("adminOriginationCases")
			.withIndex("by_bootstrap_token", (query) =>
				query.eq("bootstrapToken", args.bootstrapToken)
			)
			.unique();

		if (existing) {
			assertOriginationCaseAccess(args.viewer, existing);
			return existing._id;
		}
	}

	const validationSnapshot = computeOriginationValidationSnapshot({});

	return await ctx.db.insert("adminOriginationCases", {
		bootstrapToken: args.bootstrapToken,
		createdByUserId: user._id,
		updatedByUserId: user._id,
		orgId,
		status: "draft",
		currentStep: INITIAL_ORIGINATION_STEP,
		validationSnapshot,
		createdAt: now,
		updatedAt: now,
	});
}

async function patchOriginationCaseRecord(
	ctx: Pick<MutationCtx, "db">,
	args: {
		caseId: Doc<"adminOriginationCases">["_id"];
		patch: AdminOriginationCasePatch;
		viewer: OriginationCaseViewerContext;
	}
) {
	assertOriginationCaseAccessContext(args.viewer);

	const record = await ctx.db.get(args.caseId);
	if (!record) {
		throw new ConvexError("Origination case not found");
	}

	assertOriginationCaseAccess(args.viewer, record);
	assertMutableOriginationCase(record);

	const user = await requireViewerUser(ctx, args.viewer.authId);
	const merged = mergeOriginationCaseDraftValues(
		record as OriginationCaseDraftState,
		args.patch
	);
	const validationSnapshot = computeOriginationValidationSnapshot(merged);
	const nextStatus = resolveDraftOriginationCaseStatus({
		currentStatus: record.status,
		validationSnapshot,
	});
	const now = Date.now();

	await ctx.db.patch(args.caseId, {
		failedAt: undefined,
		currentStep: merged.currentStep,
		lastCommitError: undefined,
		participantsDraft: merged.participantsDraft,
		propertyDraft: merged.propertyDraft,
		valuationDraft: merged.valuationDraft,
		mortgageDraft: merged.mortgageDraft,
		collectionsDraft: merged.collectionsDraft,
		listingOverrides: merged.listingOverrides,
		status: nextStatus,
		validationSnapshot,
		updatedByUserId: user._id,
		updatedAt: now,
	});

	const updated = await ctx.db.get(args.caseId);
	if (!updated) {
		throw new ConvexError("Origination case disappeared during update");
	}

	return {
		...updated,
		recommendedStep: determineRecommendedOriginationStep(updated),
		stepErrorsForCurrentStep: listOriginationStepErrors(
			validationSnapshot,
			(updated.currentStep ?? INITIAL_ORIGINATION_STEP) as Parameters<
				typeof listOriginationStepErrors
			>[1]
		),
	};
}

export const createCase = originationMutation
	.input({
		bootstrapToken: v.optional(v.string()),
	})
	.handler(async (ctx, args) =>
		createOriginationCaseRecord(ctx, {
			bootstrapToken: args.bootstrapToken,
			viewer: ctx.viewer,
		})
	)
	.public();

export const listCases = originationQuery
	.handler(async (ctx) => {
		let records: Doc<"adminOriginationCases">[];

		if (ctx.viewer.isFairLendAdmin) {
			records = await ctx.db
				.query("adminOriginationCases")
				.withIndex("by_updated_at")
				.order("desc")
				.collect();
		} else {
			const orgId = requireViewerOrgId(ctx.viewer);
			records = await ctx.db
				.query("adminOriginationCases")
				.withIndex("by_org_updated_at", (query) => query.eq("orgId", orgId))
				.order("desc")
				.collect();
		}

		return records.map(summarizeCase);
	})
	.public();

export const getCase = originationQuery
	.input({
		caseId: v.id("adminOriginationCases"),
	})
	.handler(async (ctx, args) => {
		assertOriginationCaseAccessContext(ctx.viewer);

		const record = await ctx.db.get(args.caseId);
		if (!record) {
			return null;
		}

		assertOriginationCaseAccess(ctx.viewer, record);

		const recommendedStep = determineRecommendedOriginationStep({
			currentStep: record.currentStep,
			participantsDraft: record.participantsDraft,
			propertyDraft: record.propertyDraft,
			valuationDraft: record.valuationDraft,
			mortgageDraft: record.mortgageDraft,
			collectionsDraft: record.collectionsDraft,
			listingOverrides: record.listingOverrides,
			validationSnapshot: record.validationSnapshot,
		});

		return {
			...record,
			currentStep: record.currentStep ?? recommendedStep,
			label: buildOriginationCaseLabel({
				caseId: record._id,
				participantsDraft: record.participantsDraft,
				propertyDraft: record.propertyDraft,
			}),
			recommendedStep,
		};
	})
	.public();

export const patchCase = originationMutation
	.input({
		caseId: v.id("adminOriginationCases"),
		patch: adminOriginationCasePatchValidator,
	})
	.handler(async (ctx, args) =>
		patchOriginationCaseRecord(ctx, {
			caseId: args.caseId,
			patch: args.patch,
			viewer: ctx.viewer,
		})
	)
	.public();

export const recoverStuckCommittingCase = originationAdminMutation
	.input({
		caseId: v.id("adminOriginationCases"),
	})
	.handler(async (ctx, args) => {
		const record = await ctx.db.get(args.caseId);
		if (!record) {
			throw new ConvexError("Origination case not found");
		}
		if (record.status !== "committing") {
			throw new ConvexError(
				"Only origination cases in committing status can be recovered."
			);
		}

		const user = await ctx.db
			.query("users")
			.withIndex("authId", (query) => query.eq("authId", ctx.viewer.authId))
			.unique();
		if (!user) {
			throw new ConvexError("User not found in database");
		}

		const validationSnapshot = computeOriginationValidationSnapshot(record);
		const nextStatus = resolveDraftOriginationCaseStatus({
			currentStatus: record.status,
			validationSnapshot,
		});
		const now = Date.now();

		await ctx.db.patch(args.caseId, {
			failedAt: undefined,
			lastCommitError: undefined,
			status: nextStatus,
			validationSnapshot,
			updatedByUserId: user._id,
			updatedAt: now,
		});

		const updated = await ctx.db.get(args.caseId);
		if (!updated) {
			throw new ConvexError("Origination case disappeared during recovery");
		}

		return {
			...updated,
			recommendedStep: determineRecommendedOriginationStep(updated),
			stepErrorsForCurrentStep: listOriginationStepErrors(
				validationSnapshot,
				(updated.currentStep ?? INITIAL_ORIGINATION_STEP) as Parameters<
					typeof listOriginationStepErrors
				>[1]
			),
		};
	})
	.public();

export const createCaseInternal = convex
	.mutation()
	.input({
		bootstrapToken: v.optional(v.string()),
		viewerAuthId: v.string(),
		viewerIsFairLendAdmin: v.boolean(),
		viewerOrgId: v.optional(v.string()),
	})
	.handler(async (ctx, args) =>
		createOriginationCaseRecord(ctx, {
			bootstrapToken: args.bootstrapToken,
			viewer: {
				authId: args.viewerAuthId,
				isFairLendAdmin: args.viewerIsFairLendAdmin,
				orgId: args.viewerOrgId,
			},
		})
	)
	.internal();

export const patchCaseInternal = convex
	.mutation()
	.input({
		caseId: v.id("adminOriginationCases"),
		patch: adminOriginationCasePatchValidator,
		viewerAuthId: v.string(),
		viewerIsFairLendAdmin: v.boolean(),
		viewerOrgId: v.optional(v.string()),
	})
	.handler(async (ctx, args) =>
		patchOriginationCaseRecord(ctx, {
			caseId: args.caseId,
			patch: args.patch,
			viewer: {
				authId: args.viewerAuthId,
				isFairLendAdmin: args.viewerIsFairLendAdmin,
				orgId: args.viewerOrgId,
			},
		})
	)
	.internal();

export const deleteCase = originationMutation
	.input({
		caseId: v.id("adminOriginationCases"),
	})
	.handler(async (ctx, args) => {
		assertOriginationCaseAccessContext(ctx.viewer);

		const record = await ctx.db.get(args.caseId);
		if (!record) {
			return null;
		}

		assertOriginationCaseAccess(ctx.viewer, record);
		assertMutableOriginationCase(record);

		const documentDrafts = await ctx.db
			.query("originationCaseDocumentDrafts")
			.withIndex("by_case", (query) => query.eq("caseId", args.caseId))
			.collect();

		await Promise.all(
			documentDrafts.map((documentDraft) => ctx.db.delete(documentDraft._id))
		);
		await ctx.db.delete(args.caseId);

		return null;
	})
	.public();
