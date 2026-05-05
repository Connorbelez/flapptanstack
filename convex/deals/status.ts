export const KNOWN_DEAL_STATUSES = [
	"initiated",
	"lawyerOnboarding.pending",
	"lawyerOnboarding.verified",
	"lawyerOnboarding.complete",
	"documentReview.pending",
	"documentReview.signed",
	"documentReview.complete",
	"fundsTransfer.pending",
	"fundsTransfer.complete",
	"confirmed",
	"failed",
] as const;

export const ACTIVE_LAWYER_MATTER_STATUSES = [
	"lawyerOnboarding.pending",
	"lawyerOnboarding.verified",
	"lawyerOnboarding.complete",
	"documentReview.pending",
	"documentReview.signed",
	"documentReview.complete",
	"fundsTransfer.pending",
	"fundsTransfer.complete",
] as const;

export const PAST_LAWYER_MATTER_STATUSES = ["confirmed", "failed"] as const;

const activeLawyerMatterStatuses = new Set<string>(
	ACTIVE_LAWYER_MATTER_STATUSES
);
const pastLawyerMatterStatuses = new Set<string>(PAST_LAWYER_MATTER_STATUSES);

export function isActiveLawyerMatterStatus(status: string) {
	return activeLawyerMatterStatuses.has(status);
}

export function isPastLawyerMatterStatus(status: string) {
	return pastLawyerMatterStatuses.has(status);
}

export function isCompletedDealStatus(status: string) {
	return status === "confirmed";
}
