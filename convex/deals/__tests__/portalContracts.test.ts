import { describe, expect, it } from "vitest";
import {
	activeDealPortalScreenForStatus,
	canStartSigningForDealStatus,
	canUploadManualPaymentProof,
	type DealPortalPersona,
} from "../portalContracts";

describe("deal portal contracts", () => {
	it.each([
		["lawyerOnboarding.pending", "representation"],
		["lawyerOnboarding.verified", "representation"],
		["documentReview.pending", "documents"],
		["documentReview.signed", "documents"],
		["fundsTransfer.pending", "payment"],
		["confirmed", "complete"],
		["failed", "failed"],
	] as const)("maps %s to %s", (status, screen) => {
		expect(activeDealPortalScreenForStatus(status)).toBe(screen);
	});

	it("blocks new signing envelopes while representation is not confirmed", () => {
		expect(canStartSigningForDealStatus("lawyerOnboarding.pending")).toBe(
			false
		);
		expect(canStartSigningForDealStatus("lawyerOnboarding.verified")).toBe(
			false
		);
		expect(canStartSigningForDealStatus("documentReview.pending")).toBe(true);
		expect(canStartSigningForDealStatus("documentReview.signed")).toBe(false);
		expect(
			canStartSigningForDealStatus("documentReview.signed", {
				hasActiveEnvelope: false,
			})
		).toBe(false);
		expect(
			canStartSigningForDealStatus("documentReview.signed", {
				hasActiveEnvelope: true,
			})
		).toBe(true);
		expect(canStartSigningForDealStatus("confirmed")).toBe(false);
	});

	it.each([
		["purchasing_lender", true],
		["primary_lawyer", true],
		["fairlend_admin", true],
		["broker_of_record", false],
		["selling_lender", false],
	] as [
		DealPortalPersona,
		boolean,
	][])("manual payment upload for %s is %s", (persona, allowed) => {
		expect(canUploadManualPaymentProof(persona)).toBe(allowed);
	});
});
