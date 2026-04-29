import { ConvexError } from "convex/values";
import { normalizeBrokerOnboardingProvince } from "../../../shared/brokerOnboarding/contracts";
import { normalizePortalSlug } from "../../../shared/portal/contracts";
import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import type { BrokerOnboardingApplicationMachineContext } from "../../engine/machines/brokerOnboardingApplication.machine";
import { ensureFairLendPortal } from "../../portals/homePortalAssignment";

type ReaderCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;
type WriterCtx = Pick<MutationCtx, "db">;

export const BROKER_ONBOARDING_RESUME_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export type BrokerOnboardingApplicationDoc =
	Doc<"brokerOnboardingApplications">;
export type BrokerOnboardingVerificationState = NonNullable<
	BrokerOnboardingApplicationDoc["verificationState"]
>;
export type BrokerOnboardingReviewEntryInsert = Omit<
	Doc<"brokerOnboardingReviewEntries">,
	"_creationTime" | "_id"
>;

const IDENTITY_REVERIFICATION_FIELD_PREFIXES = [
	"draftData.selfReportedName",
] as const;

const REGULATOR_REVERIFICATION_FIELD_PREFIXES = [
	"draftData.licenseNumber",
	"draftData.licenseProvince",
	"draftData.brokerageNumber",
	"draftData.brokerageName",
] as const;

const REVERIFICATION_FIELD_PREFIXES = [
	...IDENTITY_REVERIFICATION_FIELD_PREFIXES,
	...REGULATOR_REVERIFICATION_FIELD_PREFIXES,
] as const;

export interface BrokerOnboardingApplicationReadModel {
	application: BrokerOnboardingApplicationDoc;
	canResume: boolean;
	downstreamOnboardingRequest: Doc<"onboardingRequests"> | null;
	isExpired: boolean;
	reviewEntries: Doc<"brokerOnboardingReviewEntries">[];
}

function normalizeOptionalString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: undefined;
}

function isClaimTrue(value: unknown) {
	return value === true || value === "true" || value === "1";
}

export function resolveVerifiedEmailFromIdentity(identity: unknown) {
	if (!(identity && typeof identity === "object")) {
		return undefined;
	}

	const email =
		normalizeOptionalString((identity as Record<string, unknown>).user_email) ??
		normalizeOptionalString((identity as Record<string, unknown>).email);
	if (!email) {
		return undefined;
	}

	const isVerified =
		isClaimTrue((identity as Record<string, unknown>).user_email_verified) ||
		isClaimTrue((identity as Record<string, unknown>).email_verified);

	return isVerified ? email.toLowerCase() : undefined;
}

export function isBrokerOnboardingTerminalStatus(
	status: BrokerOnboardingApplicationDoc["status"]
) {
	return status === "rejected" || status === "activated";
}

export function isBrokerOnboardingResumeWindowStatus(
	status: BrokerOnboardingApplicationDoc["status"]
) {
	return (
		status === "draft" ||
		status === "submitted" ||
		status === "changes_requested"
	);
}

export function isBrokerOnboardingApplicationExpired(
	application: BrokerOnboardingApplicationDoc,
	now: number
) {
	if (!isBrokerOnboardingResumeWindowStatus(application.status)) {
		return false;
	}

	return Boolean(application.expiredAt) || application.expiresAt <= now;
}

export function buildResumeWindowPatch(now: number) {
	return {
		expiresAt: now + BROKER_ONBOARDING_RESUME_WINDOW_MS,
		lastActivityAt: now,
		updatedAt: now,
	};
}

export function createDefaultBrokerOnboardingVerificationState(): BrokerOnboardingVerificationState {
	return {
		currentIdvLaunchUrl: null,
		currentIdvProviderKey: null,
		currentIdvSessionId: null,
		idvCompletedAt: null,
		idvStartedAt: null,
		lastCallbackEventId: null,
		lastCallbackProcessedAt: null,
		lastCallbackReceivedAt: null,
		lastCallbackSignatureVerified: null,
		lastRecomputedAt: null,
		requiresReverification: false,
		reverificationFieldPaths: [],
		reverificationRequiredAt: null,
	};
}

export function getBrokerOnboardingVerificationState(
	application: BrokerOnboardingApplicationDoc
): BrokerOnboardingVerificationState {
	return application.verificationState
		? {
				...application.verificationState,
				reverificationFieldPaths: [
					...application.verificationState.reverificationFieldPaths,
				],
			}
		: createDefaultBrokerOnboardingVerificationState();
}

export function mergeBrokerOnboardingVerificationState(
	current: BrokerOnboardingVerificationState | null | undefined,
	patch: Partial<BrokerOnboardingVerificationState>
): BrokerOnboardingVerificationState {
	const baseline = current ?? createDefaultBrokerOnboardingVerificationState();

	return {
		...baseline,
		...patch,
		reverificationFieldPaths:
			patch.reverificationFieldPaths ?? baseline.reverificationFieldPaths,
	};
}

export function shouldInvalidateVerificationForField(fieldPath: string) {
	return REVERIFICATION_FIELD_PREFIXES.some(
		(prefix) => fieldPath === prefix || fieldPath.startsWith(`${prefix}.`)
	);
}

export function isIdentityVerificationInvalidationField(fieldPath: string) {
	return IDENTITY_REVERIFICATION_FIELD_PREFIXES.some(
		(prefix) => fieldPath === prefix || fieldPath.startsWith(`${prefix}.`)
	);
}

export function isRegulatorVerificationInvalidationField(fieldPath: string) {
	return REGULATOR_REVERIFICATION_FIELD_PREFIXES.some(
		(prefix) => fieldPath === prefix || fieldPath.startsWith(`${prefix}.`)
	);
}

export function resolveVerificationInvalidationFieldPaths(
	reopenedFields: readonly { fieldPath: string }[]
) {
	return [
		...new Set(
			reopenedFields
				.map((reopenedField) => reopenedField.fieldPath)
				.filter(shouldInvalidateVerificationForField)
		),
	];
}

export async function getViewerUserOrThrow(ctx: ReaderCtx, authUserId: string) {
	const user = await ctx.db
		.query("users")
		.withIndex("authId", (query) => query.eq("authId", authUserId))
		.unique();
	if (!user) {
		throw new ConvexError("User not found in database");
	}
	return user;
}

export async function listCandidateBrokerApplications(
	ctx: ReaderCtx,
	args: {
		authUserId: string;
		verifiedEmail?: string;
	}
) {
	const byAuthUser = await ctx.db
		.query("brokerOnboardingApplications")
		.withIndex("by_auth_user_created_at", (query) =>
			query.eq("authUserId", args.authUserId)
		)
		.order("desc")
		.collect();
	const byVerifiedEmail = args.verifiedEmail
		? await ctx.db
				.query("brokerOnboardingApplications")
				.withIndex("by_verified_email_created_at", (query) =>
					query.eq("verifiedEmail", args.verifiedEmail)
				)
				.order("desc")
				.collect()
		: [];

	const deduped = new Map<string, BrokerOnboardingApplicationDoc>();
	for (const application of [...byAuthUser, ...byVerifiedEmail]) {
		deduped.set(String(application._id), application);
	}

	return [...deduped.values()].sort((left, right) => {
		if (left.createdAt === right.createdAt) {
			return String(right._id).localeCompare(String(left._id));
		}
		return right.createdAt - left.createdAt;
	});
}

export function selectMostRecentBrokerApplication(
	applications: readonly BrokerOnboardingApplicationDoc[]
) {
	return applications[0] ?? null;
}

export function selectResumableBrokerApplication(
	applications: readonly BrokerOnboardingApplicationDoc[],
	now: number
) {
	return (
		applications.find(
			(application) =>
				!(
					isBrokerOnboardingTerminalStatus(application.status) ||
					isBrokerOnboardingApplicationExpired(application, now)
				)
		) ?? null
	);
}

export function assertViewerCanAccessBrokerApplication(
	application: BrokerOnboardingApplicationDoc,
	args: {
		authUserId: string;
		verifiedEmail?: string;
	}
) {
	if (application.authUserId === args.authUserId) {
		return;
	}

	if (args.verifiedEmail && application.verifiedEmail === args.verifiedEmail) {
		return;
	}

	throw new ConvexError(
		"Forbidden: broker onboarding application is not accessible to this viewer"
	);
}

export async function resolveBrokerOnboardingPortalId(
	ctx: WriterCtx,
	args: {
		requestedPortalId?: BrokerOnboardingApplicationDoc["portalId"];
		user: Doc<"users">;
	}
) {
	if (args.user.homePortalId) {
		const homePortal = await ctx.db.get(args.user.homePortalId);
		if (homePortal?.status === "active" && homePortal.isPublished) {
			if (args.requestedPortalId && args.requestedPortalId !== homePortal._id) {
				throw new ConvexError(
					"Broker onboarding portal must match the trusted home portal"
				);
			}
			return homePortal._id;
		}

		if (args.requestedPortalId) {
			throw new ConvexError("Broker onboarding portal is unavailable");
		}
	}

	if (args.requestedPortalId) {
		throw new ConvexError(
			"Broker onboarding portal must match the trusted home portal"
		);
	}

	return ensureFairLendPortal(ctx);
}

export function assertPortalActiveAndPublished(
	portal: Doc<"portals"> | null,
	message = "Broker onboarding portal is unavailable"
) {
	if (!portal || portal.status !== "active" || !portal.isPublished) {
		throw new ConvexError(message);
	}

	return portal;
}

export function mergeBrokerOnboardingDraftData(
	current: BrokerOnboardingApplicationDoc["draftData"],
	patch: Partial<BrokerOnboardingApplicationDoc["draftData"]>
) {
	const nextDraftData: BrokerOnboardingApplicationDoc["draftData"] = {
		...current,
	};

	if (patch.brokerageName !== undefined) {
		nextDraftData.brokerageName = patch.brokerageName;
	}
	if (patch.brokerageNumber !== undefined) {
		nextDraftData.brokerageNumber = patch.brokerageNumber;
	}
	if (patch.businessPhone !== undefined) {
		nextDraftData.businessPhone = patch.businessPhone;
	}
	if (patch.licenseNumber !== undefined) {
		nextDraftData.licenseNumber = patch.licenseNumber;
	}
	if (patch.licenseProvince !== undefined) {
		nextDraftData.licenseProvince = normalizeBrokerOnboardingProvince(
			patch.licenseProvince
		);
	}
	if (patch.requestedPortalSlug !== undefined) {
		nextDraftData.requestedPortalSlug = normalizePortalSlug(
			patch.requestedPortalSlug
		);
	}
	if (patch.selfReportedName !== undefined) {
		nextDraftData.selfReportedName = patch.selfReportedName;
	}

	return nextDraftData;
}

export function mergeBrokerOnboardingMachineContext(
	current: BrokerOnboardingApplicationMachineContext,
	patch: Partial<BrokerOnboardingApplicationMachineContext>
) {
	return {
		...current,
		...patch,
	};
}

export function resolveReopenedFieldsForResubmission(
	reopenedFields: BrokerOnboardingApplicationDoc["reopenedFields"],
	args: {
		resolvedAt: number;
		resolvedByAuthId?: string;
	}
) {
	return reopenedFields.map((reopenedField) =>
		reopenedField.status === "open"
			? {
					...reopenedField,
					resolutionNote:
						reopenedField.resolutionNote ?? "Resolved by broker resubmission.",
					resolvedAt: args.resolvedAt,
					resolvedByAuthId: args.resolvedByAuthId,
					status: "resolved" as const,
				}
			: reopenedField
	);
}

export async function appendBrokerOnboardingReviewEntry(
	ctx: WriterCtx,
	entry: BrokerOnboardingReviewEntryInsert
) {
	return ctx.db.insert("brokerOnboardingReviewEntries", entry);
}

export async function buildBrokerOnboardingApplicationReadModel(
	ctx: ReaderCtx,
	application: BrokerOnboardingApplicationDoc,
	now: number
): Promise<BrokerOnboardingApplicationReadModel> {
	const reviewEntries = await ctx.db
		.query("brokerOnboardingReviewEntries")
		.withIndex("by_application_created_at", (query) =>
			query.eq("applicationId", application._id)
		)
		.collect();

	return {
		application,
		canResume: !(
			isBrokerOnboardingTerminalStatus(application.status) ||
			isBrokerOnboardingApplicationExpired(application, now)
		),
		downstreamOnboardingRequest: application.downstreamOnboardingRequestId
			? ((await ctx.db.get(application.downstreamOnboardingRequestId)) ?? null)
			: null,
		isExpired: isBrokerOnboardingApplicationExpired(application, now),
		reviewEntries,
	};
}
