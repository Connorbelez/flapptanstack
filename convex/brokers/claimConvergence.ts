import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { convex } from "../fluent";
import {
	getPortalByBrokerId,
	getPortalByOrgId,
	syncUserHomePortalAssignmentByUserId,
} from "../portals/homePortalAssignment";
import { ensureBrokerPortalForActivation } from "./activation";
import { resolveOrProvisionBrokerForActivation } from "./resolveOrProvision";

type BrokerClaimReaderCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;
type BrokerClaimWriterCtx = Pick<MutationCtx, "db">;

export type BrokerClaimMatchSource =
	| "auth_linked_user"
	| "verified_email"
	| "verified_license";

export type BrokerClaimManualReviewReason =
	| "ambiguous_verified_email"
	| "ambiguous_verified_license"
	| "conflicting_verified_email"
	| "conflicting_verified_license"
	| "cross_org_match"
	| "cross_user_match"
	| "duplicate_auth_linked_brokers";

export type BrokerClaimSelfServeReason =
	| "missing_verified_identifiers"
	| "no_safe_match";

export interface BrokerClaimConvergenceInput {
	applicationId?: Id<"brokerOnboardingApplications">;
	brokerageName?: string | null;
	invitedByBrokerId?: string;
	licenseProvince?: string | null;
	now: number;
	referralSource?: "broker_invite" | "self_signup";
	requestedPortalSlug?: string | null;
	targetOrganizationId: string;
	userId: Id<"users">;
	verifiedEmail?: string | null;
	verifiedLicenseId?: string | null;
}

export type BrokerClaimConvergenceOutcome =
	| {
			brokerId: Id<"brokers">;
			brokerWasPatched: boolean;
			homePortalId?: Id<"portals">;
			kind: "reused_existing_broker";
			matchedBy: BrokerClaimMatchSource[];
			nextStep: "broker_portal_ready" | "continue_self_serve_onboarding";
			portalId?: Id<"portals">;
			portalWasCreated?: boolean;
			reason: "safe_match";
	  }
	| {
			kind: "continue_self_serve_onboarding";
			nextStep: "self_serve_onboarding";
			reason: BrokerClaimSelfServeReason;
	  }
	| {
			conflictingBrokerIds?: Id<"brokers">[];
			kind: "manual_review_required";
			nextStep: "manual_review";
			reason: BrokerClaimManualReviewReason;
	  };

interface BrokerClaimCandidate {
	broker: Doc<"brokers">;
	sources: Set<BrokerClaimMatchSource>;
}

type SafeClaimBrokerPatch = Partial<
	Pick<
		Doc<"brokers">,
		| "brokerOnboardingApplicationId"
		| "brokerageName"
		| "invitedByBrokerId"
		| "licenseId"
		| "licenseProvince"
		| "orgId"
		| "referralSource"
		| "updatedAt"
	>
>;

function normalizeEmail(value?: string | null) {
	const normalized = value?.trim().toLowerCase();
	return normalized ? normalized : undefined;
}

function normalizeLicenseId(value?: string | null) {
	const normalized = value?.trim().toUpperCase();
	return normalized ? normalized : undefined;
}

function normalizeOptionalString(value?: string | null) {
	const normalized = value?.trim();
	return normalized ? normalized : undefined;
}

function continueSelfServe(
	reason: BrokerClaimSelfServeReason
): BrokerClaimConvergenceOutcome {
	return {
		kind: "continue_self_serve_onboarding",
		nextStep: "self_serve_onboarding",
		reason,
	};
}

function manualReview(args: {
	conflictingBrokerIds?: Id<"brokers">[];
	reason: BrokerClaimManualReviewReason;
}): BrokerClaimConvergenceOutcome {
	return {
		kind: "manual_review_required",
		nextStep: "manual_review",
		...args,
	};
}

async function collectBrokersByUserId(
	ctx: BrokerClaimReaderCtx,
	userId: Id<"users">
) {
	return ctx.db
		.query("brokers")
		.withIndex("by_user", (query) => query.eq("userId", userId))
		.collect();
}

async function collectBrokersByLicense(
	ctx: BrokerClaimReaderCtx,
	licenseId: string
) {
	return ctx.db
		.query("brokers")
		.withIndex("by_license", (query) => query.eq("licenseId", licenseId))
		.collect();
}

async function collectUsersByEmail(ctx: BrokerClaimReaderCtx, email: string) {
	const normalizedEmail = normalizeEmail(email);
	if (!normalizedEmail) {
		return [];
	}
	const [usersByNormalizedEmail, usersByEmail] = await Promise.all([
		ctx.db
			.query("users")
			.withIndex("by_normalized_email", (query) =>
				query.eq("normalizedEmail", normalizedEmail)
			)
			.collect(),
		ctx.db
			.query("users")
			.withIndex("by_email", (query) => query.eq("email", normalizedEmail))
			.collect(),
	]);
	const usersById = new Map<string, Doc<"users">>();
	for (const user of [...usersByNormalizedEmail, ...usersByEmail]) {
		usersById.set(String(user._id), user);
	}
	return [...usersById.values()];
}

function addCandidate(
	candidates: Map<string, BrokerClaimCandidate>,
	broker: Doc<"brokers">,
	source: BrokerClaimMatchSource
) {
	const key = String(broker._id);
	const existing = candidates.get(key);
	if (existing) {
		existing.sources.add(source);
		return;
	}
	candidates.set(key, {
		broker,
		sources: new Set([source]),
	});
}

async function collectClaimCandidates(
	ctx: BrokerClaimReaderCtx,
	args: {
		user: Doc<"users">;
		verifiedEmail: string;
		verifiedLicenseId: string;
	}
): Promise<
	| { candidates: Map<string, BrokerClaimCandidate>; kind: "ready" }
	| { kind: "manual_review"; outcome: BrokerClaimConvergenceOutcome }
> {
	const candidates = new Map<string, BrokerClaimCandidate>();
	const authLinkedBrokers = await collectBrokersByUserId(ctx, args.user._id);
	if (authLinkedBrokers.length > 1) {
		return {
			kind: "manual_review",
			outcome: manualReview({
				conflictingBrokerIds: authLinkedBrokers.map((broker) => broker._id),
				reason: "duplicate_auth_linked_brokers",
			}),
		};
	}
	for (const broker of authLinkedBrokers) {
		addCandidate(candidates, broker, "auth_linked_user");
	}

	const usersByEmail = await collectUsersByEmail(ctx, args.verifiedEmail);
	if (usersByEmail.length > 1) {
		return {
			kind: "manual_review",
			outcome: manualReview({ reason: "ambiguous_verified_email" }),
		};
	}
	const emailUser = usersByEmail[0];
	if (emailUser && emailUser._id !== args.user._id) {
		const emailUserBrokers = await collectBrokersByUserId(ctx, emailUser._id);
		return {
			kind: "manual_review",
			outcome: manualReview({
				conflictingBrokerIds: emailUserBrokers.map((broker) => broker._id),
				reason: "conflicting_verified_email",
			}),
		};
	}
	if (emailUser) {
		for (const broker of authLinkedBrokers) {
			addCandidate(candidates, broker, "verified_email");
		}
	}

	const licenseBrokers = await collectBrokersByLicense(
		ctx,
		args.verifiedLicenseId
	);
	if (licenseBrokers.length > 1) {
		return {
			kind: "manual_review",
			outcome: manualReview({
				conflictingBrokerIds: licenseBrokers.map((broker) => broker._id),
				reason: "ambiguous_verified_license",
			}),
		};
	}
	for (const broker of licenseBrokers) {
		addCandidate(candidates, broker, "verified_license");
	}

	return { candidates, kind: "ready" };
}

function validateSingleSafeCandidate(args: {
	candidates: Map<string, BrokerClaimCandidate>;
	targetOrganizationId: string;
	userId: Id<"users">;
	verifiedLicenseId: string;
}): BrokerClaimConvergenceOutcome | BrokerClaimCandidate {
	if (args.candidates.size === 0) {
		return continueSelfServe("no_safe_match");
	}
	if (args.candidates.size > 1) {
		return manualReview({
			conflictingBrokerIds: [...args.candidates.values()].map(
				(candidate) => candidate.broker._id
			),
			reason: "conflicting_verified_license",
		});
	}

	const candidate = [...args.candidates.values()][0];
	if (!candidate) {
		return continueSelfServe("no_safe_match");
	}
	if (candidate.broker.userId !== args.userId) {
		return manualReview({
			conflictingBrokerIds: [candidate.broker._id],
			reason: "cross_user_match",
		});
	}
	if (
		candidate.broker.orgId &&
		candidate.broker.orgId !== args.targetOrganizationId
	) {
		return manualReview({
			conflictingBrokerIds: [candidate.broker._id],
			reason: "cross_org_match",
		});
	}
	if (
		candidate.broker.licenseId &&
		candidate.broker.licenseId !== args.verifiedLicenseId
	) {
		return manualReview({
			conflictingBrokerIds: [candidate.broker._id],
			reason: "conflicting_verified_license",
		});
	}

	return candidate;
}

async function patchSafeClaimBrokerFields(
	ctx: BrokerClaimWriterCtx,
	broker: Doc<"brokers">,
	args: BrokerClaimConvergenceInput & { verifiedLicenseId: string }
) {
	const brokerageName = normalizeOptionalString(args.brokerageName);
	const licenseProvince = normalizeOptionalString(args.licenseProvince);
	const patch: SafeClaimBrokerPatch = { updatedAt: args.now };

	if (args.applicationId && !broker.brokerOnboardingApplicationId) {
		patch.brokerOnboardingApplicationId = args.applicationId;
	}
	if (brokerageName && !broker.brokerageName) {
		patch.brokerageName = brokerageName;
	}
	if (args.invitedByBrokerId && !broker.invitedByBrokerId) {
		patch.invitedByBrokerId = args.invitedByBrokerId;
	}
	if (!broker.licenseId) {
		patch.licenseId = args.verifiedLicenseId;
	}
	if (licenseProvince && !broker.licenseProvince) {
		patch.licenseProvince = licenseProvince;
	}
	if (!broker.orgId) {
		patch.orgId = args.targetOrganizationId;
	}
	if (args.referralSource && !broker.referralSource) {
		patch.referralSource = args.referralSource;
	}

	await ctx.db.patch(broker._id, patch);
	const patchedBroker = await ctx.db.get(broker._id);
	if (!patchedBroker) {
		throw new ConvexError("Broker record disappeared during claim convergence");
	}
	return {
		broker: patchedBroker,
		wasPatched: Object.keys(patch).some((field) => field !== "updatedAt"),
	};
}

async function getExistingClaimPortalSlug(
	ctx: BrokerClaimReaderCtx,
	args: {
		brokerId: Id<"brokers">;
		orgId: string;
	}
) {
	const byBroker = await getPortalByBrokerId(ctx, args.brokerId);
	const byOrg = await getPortalByOrgId(ctx, args.orgId);
	if (byBroker && byOrg && byBroker._id !== byOrg._id) {
		throw new ConvexError(
			"Claim convergence found conflicting broker and organization portals"
		);
	}
	return (byBroker ?? byOrg)?.slug;
}

export async function convergeBrokerClaimToCanonicalBroker(
	ctx: BrokerClaimWriterCtx,
	args: BrokerClaimConvergenceInput
): Promise<BrokerClaimConvergenceOutcome> {
	const verifiedEmail = normalizeEmail(args.verifiedEmail);
	const verifiedLicenseId = normalizeLicenseId(args.verifiedLicenseId);
	const targetOrganizationId = normalizeOptionalString(
		args.targetOrganizationId
	);
	if (!(verifiedEmail && verifiedLicenseId)) {
		return continueSelfServe("missing_verified_identifiers");
	}
	if (!targetOrganizationId) {
		throw new ConvexError("Claim convergence requires a target organization");
	}

	const user = await ctx.db.get(args.userId);
	if (!user) {
		throw new ConvexError("Claim convergence user not found");
	}
	if (normalizeEmail(user.email) !== verifiedEmail) {
		return manualReview({ reason: "conflicting_verified_email" });
	}

	const candidateResult = await collectClaimCandidates(ctx, {
		user,
		verifiedEmail,
		verifiedLicenseId,
	});
	if (candidateResult.kind === "manual_review") {
		return candidateResult.outcome;
	}

	const candidate = validateSingleSafeCandidate({
		candidates: candidateResult.candidates,
		targetOrganizationId,
		userId: user._id,
		verifiedLicenseId,
	});
	if ("kind" in candidate) {
		return candidate;
	}

	const requestedPortalSlug = normalizeOptionalString(args.requestedPortalSlug);
	if (!requestedPortalSlug) {
		const patchResult = await patchSafeClaimBrokerFields(
			ctx,
			candidate.broker,
			{
				...args,
				targetOrganizationId,
				verifiedLicenseId,
			}
		);
		return {
			brokerId: patchResult.broker._id,
			brokerWasPatched: patchResult.wasPatched,
			kind: "reused_existing_broker",
			matchedBy: [...candidate.sources],
			nextStep: "continue_self_serve_onboarding",
			reason: "safe_match",
		};
	}

	const activationPortalSlug =
		(await getExistingClaimPortalSlug(ctx, {
			brokerId: candidate.broker._id,
			orgId: targetOrganizationId,
		})) ?? requestedPortalSlug;
	const brokerResult = await resolveOrProvisionBrokerForActivation(ctx, {
		applicationId:
			candidate.broker.brokerOnboardingApplicationId ?? args.applicationId,
		brokerageName: candidate.broker.brokerageName ?? args.brokerageName,
		invitedByBrokerId:
			candidate.broker.invitedByBrokerId ?? args.invitedByBrokerId,
		licenseId: verifiedLicenseId,
		licenseProvince: candidate.broker.licenseProvince ?? args.licenseProvince,
		now: args.now,
		referralSource: candidate.broker.referralSource ?? args.referralSource,
		targetOrganizationId,
		userId: user._id,
	});
	if (brokerResult.wasCreated) {
		throw new ConvexError(
			"Claim convergence attempted to provision a broker without a safe match"
		);
	}

	const portalResult = await ensureBrokerPortalForActivation(ctx, {
		broker: brokerResult.broker,
		now: args.now,
		orgId: targetOrganizationId,
		requestedSlug: activationPortalSlug,
	});
	await ctx.db.patch(brokerResult.broker._id, {
		activatedPortalId: portalResult.portal._id,
		updatedAt: args.now,
	});
	const homePortalSync = await syncUserHomePortalAssignmentByUserId(
		ctx,
		user._id
	);
	if (!homePortalSync) {
		throw new ConvexError("Claim convergence home portal sync failed");
	}
	if (homePortalSync.homePortalId !== portalResult.portal._id) {
		throw new ConvexError(
			"Claim convergence did not synchronize the broker portal as home portal"
		);
	}

	return {
		brokerId: brokerResult.broker._id,
		brokerWasPatched:
			brokerResult.wasPatched ||
			brokerResult.broker.activatedPortalId !== portalResult.portal._id,
		homePortalId: homePortalSync.homePortalId,
		kind: "reused_existing_broker",
		matchedBy: [...candidate.sources],
		nextStep: "broker_portal_ready",
		portalId: portalResult.portal._id,
		portalWasCreated: portalResult.wasCreated,
		reason: "safe_match",
	};
}

export const convergeBrokerClaimHarness = convex
	.mutation()
	.input({
		applicationId: v.optional(v.id("brokerOnboardingApplications")),
		brokerageName: v.optional(v.string()),
		invitedByBrokerId: v.optional(v.string()),
		licenseProvince: v.optional(v.string()),
		now: v.optional(v.number()),
		referralSource: v.optional(
			v.union(v.literal("broker_invite"), v.literal("self_signup"))
		),
		requestedPortalSlug: v.optional(v.string()),
		targetOrganizationId: v.string(),
		userId: v.id("users"),
		verifiedEmail: v.optional(v.string()),
		verifiedLicenseId: v.optional(v.string()),
	})
	.handler(async (ctx, args) => {
		return convergeBrokerClaimToCanonicalBroker(ctx, {
			...args,
			now: args.now ?? Date.now(),
		});
	})
	.internal();
