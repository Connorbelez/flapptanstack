import type { DealPersona } from "../../src/lib/deals/access-policy/types";

export type DealPortalScreen =
	| "representation"
	| "documents"
	| "payment"
	| "complete"
	| "failed"
	| "unavailable";

export type DealPortalPersona = DealPersona;

export type DealPortalCapability =
	| "representation.onboarding.resume"
	| "representation.invitation.resend"
	| "representation.invitation.revoke"
	| "representation.lawyer.replace"
	| "representation.adminOverride"
	| "representation.confirm"
	| "representation.progressDeal"
	| "documents.generate"
	| "documents.approve"
	| "documents.skipEmpty"
	| "documents.sign"
	| "payment.proof.upload"
	| "payment.proof.review"
	| "payment.proof.approve"
	| "payment.proof.reject";

export interface PortalBlocker {
	adminDiagnostics?: Record<string, string>;
	code: string;
	message: string;
	recoverableAction: string | null;
	severity: "info" | "warning" | "error";
}

export function activeDealPortalScreenForStatus(
	status: string | null | undefined
): DealPortalScreen {
	switch (status) {
		case "lawyerOnboarding.pending":
		case "lawyerOnboarding.verified":
			return "representation";
		case "documentReview.pending":
		case "documentReview.signed":
			return "documents";
		case "fundsTransfer.pending":
			return "payment";
		case "confirmed":
			return "complete";
		case "failed":
			return "failed";
		default:
			return "unavailable";
	}
}

export function canStartSigningForDealStatus(
	status: string | null | undefined,
	options: { readonly hasActiveEnvelope?: boolean } = {}
): boolean {
	if (status === "documentReview.pending") {
		return true;
	}
	return (
		status === "documentReview.signed" && options.hasActiveEnvelope === true
	);
}

export function canUploadManualPaymentProof(
	persona: DealPortalPersona
): boolean {
	return (
		persona === "purchasing_lender" ||
		persona === "primary_lawyer" ||
		persona === "fairlend_admin"
	);
}
