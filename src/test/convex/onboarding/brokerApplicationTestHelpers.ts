import { api, internal } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG } from "../../../../convex/onboarding/verification/config";
import {
	DEFAULT_PORTAL_POST_AUTH_PATH,
	DEFAULT_PORTAL_TEASER_LIMIT,
	buildPortalHosts,
} from "../../../../convex/portals/helpers";
import { createBrokerOnboardingVerificationSnapshot } from "../../../../shared/brokerOnboarding/contracts";
import type { MockIdentity } from "../../auth/helpers";
import {
	createMockIdentity,
	ensureSeededIdentity,
} from "../../auth/helpers";
import type { GovernedTestConvex } from "./helpers";

export function buildVerifiedMemberIdentity(label: string): MockIdentity {
	return createMockIdentity({
		subject: `user_broker_application_${label}`,
		user_email: `${label}@fairlend.test`,
		user_email_verified: "true",
	});
}

export async function createActivePortal(
	t: GovernedTestConvex,
	slug: string
): Promise<Id<"portals">> {
	return t.run(async (ctx) => {
		const now = Date.now();
		const hosts = buildPortalHosts(slug);
		return ctx.db.insert("portals", {
			slug,
			portalType: "broker",
			brokerId: undefined,
			orgId: `org_${slug}`,
			productionHost: hosts.productionHost,
			localHost: hosts.localHost,
			status: "active",
			isPublished: true,
			publicTeaserEnabled: true,
			teaserListingLimit: DEFAULT_PORTAL_TEASER_LIMIT,
			defaultPostAuthPath: DEFAULT_PORTAL_POST_AUTH_PATH,
			createdAt: now,
			updatedAt: now,
		});
	});
}

export async function getApplication(
	t: GovernedTestConvex,
	applicationId: Id<"brokerOnboardingApplications">
) {
	return t.run(async (ctx) => ctx.db.get(applicationId));
}

export async function getReviewEntries(
	t: GovernedTestConvex,
	applicationId: Id<"brokerOnboardingApplications">
) {
	return t.run(async (ctx) =>
		ctx.db
			.query("brokerOnboardingReviewEntries")
			.withIndex("by_application_created_at", (query) =>
				query.eq("applicationId", applicationId)
			)
			.collect()
	);
}

export async function getUserByAuthId(
	t: GovernedTestConvex,
	authId: string
) {
	return t.run(async (ctx) =>
		ctx.db
			.query("users")
			.filter((query) => query.eq(query.field("authId"), authId))
			.first()
	);
}

export async function countApplicationsForAuthUser(
	t: GovernedTestConvex,
	authUserId: string
) {
	return t.run(async (ctx) =>
		ctx.db
			.query("brokerOnboardingApplications")
			.withIndex("by_auth_user", (query) => query.eq("authUserId", authUserId))
			.collect()
	);
}

export async function startBrokerApplication(
	t: GovernedTestConvex,
	identity: MockIdentity,
	args?: {
		portalId?: Id<"portals">;
		referralToken?: string;
	}
) {
	await ensureSeededIdentity(t, identity);
	return t
		.withIdentity(identity)
		.mutation(api.onboarding.brokerApplication.mutations.startOrResume, {
			portalId: args?.portalId,
			referralToken: args?.referralToken,
		});
}

export async function saveBrokerApplicationDraft(
	t: GovernedTestConvex,
	identity: MockIdentity,
	args: {
		applicationId: Id<"brokerOnboardingApplications">;
		currentStep?: string;
		draftData: Partial<Doc<"brokerOnboardingApplications">["draftData"]>;
	}
) {
	return t
		.withIdentity(identity)
		.mutation(api.onboarding.brokerApplication.mutations.saveDraft, args);
}

export async function prepareActivationReadyBrokerApplication(
	t: GovernedTestConvex,
	identity: MockIdentity,
	args: {
		applicationId: Id<"brokerOnboardingApplications">;
		brokerageName?: string;
		brokerageNumber?: string;
		licenseNumber?: string;
		portalSlug?: string;
	}
) {
	const brokerageName = args.brokerageName ?? "FairLend Test Brokerage";
	const licenseNumber = args.licenseNumber ?? `ON-${args.portalSlug ?? "broker"}`;
	const portalSlug = args.portalSlug ?? `broker-${String(args.applicationId).slice(-8)}`;
	const capturedAt = Date.now();
	const selfReportedName = { fullName: "Francois Smith" };

	await saveBrokerApplicationDraft(t, identity, {
		applicationId: args.applicationId,
		currentStep: "review",
		draftData: {
			brokerageName,
			brokerageNumber: args.brokerageNumber ?? "BR-001",
			licenseNumber,
			licenseProvince: "ON",
			requestedPortalSlug: portalSlug,
			selfReportedName,
		},
	});

	const snapshot = createBrokerOnboardingVerificationSnapshot({
		capturedAt,
		policy: DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG,
		province: "ON",
		selfReportedName,
		regulator: {
			provider: "mock_regulator",
			status: "active",
			freshness: "fresh",
			licenseNumber,
			licenseProvince: "ON",
			legalName: selfReportedName,
			brokerageName,
			brokerageNumber: args.brokerageNumber ?? "BR-001",
			checkedAt: capturedAt,
			dataAsOf: capturedAt,
			evidenceReferences: [],
		},
		identityVerification: {
			provider: "mock_identity",
			status: "verified",
			legalName: selfReportedName,
			checkedAt: capturedAt,
			completedAt: capturedAt,
			fraudSignal: false,
			evidenceReferences: [],
		},
		emailVerification: {
			provider: "workos_authkit",
			status: "verified",
			email: identity.user_email,
			checkedAt: capturedAt,
			verifiedAt: capturedAt,
			evidenceReferences: [],
		},
		similarityScores: {
			regulatorVsIdentity: 1,
			selfReportedVsIdentity: 1,
			selfReportedVsRegulator: 1,
		},
	});
	await upsertBrokerVerificationSnapshot(t, {
		applicationId: args.applicationId,
		authorAuthId: "verification_test",
		authorType: "system",
		snapshot,
	});

	return {
		licenseNumber,
		portalSlug,
		snapshot,
	};
}

export async function submitBrokerApplication(
	t: GovernedTestConvex,
	identity: MockIdentity,
	applicationId: Id<"brokerOnboardingApplications">
) {
	return t
		.withIdentity(identity)
		.mutation(api.onboarding.brokerApplication.mutations.submit, {
			applicationId,
		});
}

export async function appendBrokerNote(
	t: GovernedTestConvex,
	identity: MockIdentity,
	args: {
		applicationId: Id<"brokerOnboardingApplications">;
		body: string;
	}
) {
	return t
		.withIdentity(identity)
		.mutation(api.onboarding.brokerApplication.mutations.appendBrokerNote, args);
}

export async function startBrokerIdentityVerification(
	t: GovernedTestConvex,
	identity: MockIdentity,
	applicationId: Id<"brokerOnboardingApplications">
) {
	return t
		.withIdentity(identity)
		.action(
			"onboarding/verification/actions:startBrokerOnboardingIdentityVerification",
			{
				applicationId,
			}
		);
}

export async function recomputeBrokerVerification(
	t: GovernedTestConvex,
	identity: MockIdentity,
	applicationId: Id<"brokerOnboardingApplications">
) {
	return t
		.withIdentity(identity)
		.action(
			"onboarding/verification/actions:recomputeBrokerOnboardingVerification",
			{
				applicationId,
			}
		);
}

export async function approveBrokerApplication(
	t: GovernedTestConvex,
	applicationId: Id<"brokerOnboardingApplications">,
	authorAuthId = "admin_test"
) {
	return t.mutation(internal.onboarding.brokerApplication.internal.approveApplication, {
		applicationId,
		authorAuthId,
		authorType: "admin",
	});
}

export async function requestBrokerApplicationChanges(
	t: GovernedTestConvex,
	args: {
		applicationId: Id<"brokerOnboardingApplications">;
		body: string;
		reopenedFields: Array<{ fieldPath: string; reason?: string }>;
	}
) {
	return t.mutation(
		internal.onboarding.brokerApplication.internal.requestChanges,
		{
			...args,
			authorAuthId: "admin_test",
			authorType: "admin",
		}
	);
}

export async function upsertBrokerVerificationSnapshot(
	t: GovernedTestConvex,
	args: Parameters<
		typeof t.mutation<
			typeof internal.onboarding.brokerApplication.internal.upsertVerificationSnapshot
		>
	>[1]
) {
	return t.mutation(
		internal.onboarding.brokerApplication.internal.upsertVerificationSnapshot,
		args
	);
}

export async function insertDownstreamOnboardingRequest(
	t: GovernedTestConvex,
	args: {
		portalId?: Id<"portals">;
		status: Doc<"onboardingRequests">["status"];
		userId: Id<"users">;
	}
) {
	return t.run(async (ctx) => {
		const now = Date.now();
		return ctx.db.insert("onboardingRequests", {
			userId: args.userId,
			requestedRole: "broker",
			status: args.status,
			machineContext: undefined,
			lastTransitionAt: now,
			referralSource: "self_signup",
			brokerOnboardingApplicationId: undefined,
			targetOrganizationId: undefined,
			portalId: args.portalId,
			createdAt: now,
		});
	});
}

export async function linkDownstreamOnboardingRequest(
	t: GovernedTestConvex,
	args: {
		applicationId: Id<"brokerOnboardingApplications">;
		onboardingRequestId: Id<"onboardingRequests">;
	}
) {
	return t.mutation(
		internal.onboarding.brokerApplication.internal.linkDownstreamOnboardingRequest,
		{
			...args,
			authorAuthId: "admin_test",
			authorType: "admin",
		}
	);
}

export async function markDownstreamRoleAssigned(
	t: GovernedTestConvex,
	applicationId: Id<"brokerOnboardingApplications">
) {
	return t.mutation(
		internal.onboarding.brokerApplication.internal.markDownstreamRoleAssigned,
		{
			applicationId,
			authorAuthId: "admin_test",
			authorType: "admin",
		}
	);
}

export async function markBrokerApplicationActivated(
	t: GovernedTestConvex,
	args: {
		activatedHomePortalId: Id<"portals">;
		activatedPortalId: Id<"portals">;
		applicationId: Id<"brokerOnboardingApplications">;
	}
) {
	return t.mutation(
		internal.onboarding.brokerApplication.internal.markActivated,
		{
			...args,
			authorAuthId: "admin_test",
			authorType: "admin",
		}
	);
}
