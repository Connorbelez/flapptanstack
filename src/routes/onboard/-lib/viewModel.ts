import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";
import {
	buildPortalHosts,
	normalizePortalSlug,
} from "../../../../shared/portal/contracts";

const DRAFT_DATA_PREFIX_REGEX = /^draftData\./;

export type BrokerOnboardingReadModel = NonNullable<
	FunctionReturnType<typeof api.onboarding.brokerApplication.queries.getCurrent>
>;
export type BrokerOnboardingApplication =
	BrokerOnboardingReadModel["application"];
export type BrokerOnboardingReviewEntry =
	BrokerOnboardingReadModel["reviewEntries"][number];
export type SaveDraftArgs = FunctionArgs<
	typeof api.onboarding.brokerApplication.mutations.saveDraft
>;
export type SubmitArgs = FunctionArgs<
	typeof api.onboarding.brokerApplication.mutations.submit
>;
export type AppendBrokerNoteArgs = FunctionArgs<
	typeof api.onboarding.brokerApplication.mutations.appendBrokerNote
>;
export type StartIdentityVerificationArgs = FunctionArgs<
	typeof api.onboarding.verification.actions.startBrokerOnboardingIdentityVerification
>;
export type StartIdentityVerificationResult = FunctionReturnType<
	typeof api.onboarding.verification.actions.startBrokerOnboardingIdentityVerification
>;

export type SaveDraftFn = (
	args: SaveDraftArgs
) => Promise<BrokerOnboardingReadModel>;
export type SubmitFn = (args: SubmitArgs) => Promise<BrokerOnboardingReadModel>;
export type AppendBrokerNoteFn = (
	args: AppendBrokerNoteArgs
) => Promise<BrokerOnboardingReadModel>;
export type StartIdentityVerificationFn = (
	args: StartIdentityVerificationArgs
) => Promise<StartIdentityVerificationResult>;

export interface OnboardingChapter {
	description: string;
	key: string;
	label: string;
}

export const ONBOARDING_CHAPTERS: readonly OnboardingChapter[] = [
	{
		key: "profile",
		label: "Profile",
		description: "Brokerage, license, and principal broker details",
	},
	{
		key: "verification",
		label: "Verification",
		description: "WorkOS email, regulator evidence, and IDV",
	},
	{
		key: "portal",
		label: "Portal",
		description: "Branded portal preview and preferred slug",
	},
	{
		key: "submit",
		label: "Submit",
		description: "Review summary and final submission",
	},
] as const;

const FIELD_LABELS: Record<string, string> = {
	"draftData.brokerageName": "Brokerage name",
	"draftData.brokerageNumber": "Brokerage number",
	"draftData.businessPhone": "Business phone",
	"draftData.licenseNumber": "License number",
	"draftData.licenseProvince": "License province",
	"draftData.requestedPortalSlug": "Portal slug",
	"draftData.selfReportedName": "Legal name",
};

export function getApplicationChapterKey(
	application: BrokerOnboardingApplication
) {
	const current = application.machineContext.currentStep;
	if (
		current &&
		ONBOARDING_CHAPTERS.some((chapter) => chapter.key === current)
	) {
		return current;
	}

	if (
		!(
			application.draftData.licenseNumber && application.draftData.brokerageName
		)
	) {
		return "profile";
	}
	if (!application.verificationSnapshot && application.status === "draft") {
		return "verification";
	}
	if (!application.draftData.requestedPortalSlug) {
		return "portal";
	}
	return "submit";
}

export function getChapterProgress(application: BrokerOnboardingApplication) {
	const activeKey = getApplicationChapterKey(application);
	const activeIndex = Math.max(
		0,
		ONBOARDING_CHAPTERS.findIndex((chapter) => chapter.key === activeKey)
	);
	return {
		activeIndex,
		activeKey,
		percent:
			ONBOARDING_CHAPTERS.length <= 1
				? 100
				: Math.round((activeIndex / (ONBOARDING_CHAPTERS.length - 1)) * 100),
	};
}

export function getStatusLabel(status: BrokerOnboardingApplication["status"]) {
	switch (status) {
		case "draft":
			return "Draft";
		case "submitted":
			return "Submitted";
		case "changes_requested":
			return "Changes requested";
		case "approved":
			return "Approved, provisioning";
		case "rejected":
			return "Not approved";
		case "activated":
			return "Activated";
		default: {
			const exhaustiveCheck: never = status;
			return exhaustiveCheck;
		}
	}
}

export function getFieldLabel(fieldPath: string) {
	return (
		FIELD_LABELS[fieldPath] ?? fieldPath.replace(DRAFT_DATA_PREFIX_REGEX, "")
	);
}

export function getOpenReopenedFields(
	application: BrokerOnboardingApplication
) {
	return application.reopenedFields.filter((field) => field.status === "open");
}

export function getLatestReviewerEntry(readModel: BrokerOnboardingReadModel) {
	return [...readModel.reviewEntries]
		.reverse()
		.find((entry) => entry.entryType === "reviewer_note");
}

export function getReviewThread(readModel: BrokerOnboardingReadModel) {
	return [...readModel.reviewEntries].sort(
		(left, right) => left.createdAt - right.createdAt
	);
}

export function getPortalPreviewSeed(application: BrokerOnboardingApplication) {
	const rawSlug =
		application.draftData.requestedPortalSlug ??
		application.draftData.brokerageName ??
		"your-brokerage";
	const normalizedSlug = normalizePortalSlug(rawSlug) || "your-brokerage";
	return {
		hosts: buildPortalHosts(normalizedSlug),
		normalizedSlug,
	};
}

export function getSubmittedDetails(application: BrokerOnboardingApplication) {
	const draft = application.draftData;
	return [
		{ label: "Legal name", value: draft.selfReportedName?.fullName },
		{ label: "Brokerage", value: draft.brokerageName },
		{ label: "Brokerage number", value: draft.brokerageNumber },
		{ label: "License", value: draft.licenseNumber },
		{ label: "Province", value: draft.licenseProvince },
		{ label: "Portal slug", value: draft.requestedPortalSlug },
	].filter((item): item is { label: string; value: string } =>
		Boolean(item.value)
	);
}

export function getReverificationCopy(
	application: BrokerOnboardingApplication
) {
	const state = application.verificationState;
	if (
		!state?.requiresReverification ||
		state.reverificationFieldPaths.length === 0
	) {
		return "No reverification is currently required.";
	}
	return `Reverification is required for ${state.reverificationFieldPaths
		.map(getFieldLabel)
		.join(", ")}.`;
}
