import type { BrokerOnboardingReadModel } from "#/routes/onboard/-lib/viewModel";

export const PORTAL_CONTEXT = {
	availability: "active",
	cacheKey: "portal:meridian:active:local:meridian.localhost:3000",
	canonicalHost: "meridian.localhost:3000",
	kind: "portal",
	matchedHostType: "local",
	portal: {
		defaultPostAuthPath: "/",
		isPublished: true,
		localHost: "meridian.localhost:3000",
		portalId: "portal_meridian",
		portalType: "broker",
		productionHost: "meridian.fairlend.ca",
		publicTeaserEnabled: true,
		slug: "meridian",
		status: "active",
		teaserListingLimit: 12,
	},
	requestedHost: "meridian.localhost:3000",
} as const;

export function createOnboardingReadModel(
	status: BrokerOnboardingReadModel["application"]["status"],
	overrides: Partial<BrokerOnboardingReadModel["application"]> = {}
): BrokerOnboardingReadModel {
	const now = Date.now();
	const application: BrokerOnboardingReadModel["application"] = {
		_id: "application_1" as never,
		_creationTime: now,
		authUserId: "user_broker",
		createdAt: now - 1000,
		downstreamHandoffStatus:
			status === "activated"
				? "activated"
				: status === "approved"
					? "linked"
					: "not_started",
		draftData: {
			brokerageName: "Meridian Capital",
			brokerageNumber: "BR-12345",
			businessPhone: "416-555-0100",
			licenseNumber: "M08000001",
			licenseProvince: "ON",
			requestedPortalSlug: "meridian-capital",
			selfReportedName: { fullName: "Casey Broker" },
		},
		expiresAt: now + 1_000_000,
		lastActivityAt: now - 500,
		lastTransitionAt: now - 500,
		machineContext: {
			activationCompletedAt: status === "activated" ? now - 100 : null,
			approvedAt:
				status === "approved" || status === "activated" ? now - 200 : null,
			changesRequestedAt: status === "changes_requested" ? now - 300 : null,
			currentStep: "portal",
			draftLastSavedAt: now - 600,
			rejectedAt: status === "rejected" ? now - 100 : null,
			submittedAt: status !== "draft" ? now - 700 : null,
			submitCount: status === "draft" ? 0 : 1,
		},
		portalId: "portal_meridian" as never,
		referralSource: "self_signup",
		reopenedFields:
			status === "changes_requested"
				? [
						{
							fieldPath: "draftData.licenseNumber",
							reason: "License number did not match the regulator record.",
							requestedAt: now - 300,
							status: "open",
						},
					]
				: [],
		startedAt: now - 2000,
		status,
		updatedAt: now - 500,
		userId: "user_doc" as never,
		verificationReasonCodes:
			status === "submitted" ? ["effective_score_requires_review"] : [],
		verificationState: {
			currentIdvLaunchUrl: null,
			currentIdvProviderKey: "mock_identity",
			currentIdvSessionId: null,
			idvCompletedAt: status === "draft" ? null : now - 600,
			idvStartedAt: status === "draft" ? null : now - 900,
			lastCallbackEventId: null,
			lastCallbackProcessedAt: null,
			lastCallbackReceivedAt: null,
			lastCallbackSignatureVerified: null,
			lastRecomputedAt: now - 400,
			requiresReverification: status === "changes_requested",
			reverificationFieldPaths:
				status === "changes_requested" ? ["draftData.licenseNumber"] : [],
			reverificationRequiredAt: status === "changes_requested" ? now - 300 : null,
		},
		verifiedEmail: "casey@example.com",
		...overrides,
	};

	return {
		application,
		canResume: status !== "activated" && status !== "rejected",
		downstreamOnboardingRequest: null,
		isExpired: false,
		reviewEntries: [
			{
				_id: "entry_1" as never,
				_creationTime: now - 250,
				applicationId: application._id,
				body:
					status === "changes_requested"
						? "Please correct the license number and resubmit."
						: "Application submitted for review.",
				createdAt: now - 250,
				entryType: status === "changes_requested" ? "reviewer_note" : "system_event",
				systemEventType:
					status === "changes_requested" ? undefined : "application_submitted",
			},
		],
	};
}
