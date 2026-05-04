import { describe, expect, it } from "vitest";
import {
	buildDealDocumentRemediation,
	getDealDocumentRemediationEligibility,
} from "../../../../convex/documents/dealPackageRemediationModel";

const baseInput = {
	archivedAt: null,
	lastError: null,
	sourceBlueprintId: "blueprint_1",
	sourceBlueprintSnapshot: {
		class: "private_templated_signable",
		templateId: "template_1",
	},
	status: "generation_failed",
	supersededByInstanceId: null,
} as const;

describe("dealPackageRemediationModel", () => {
	it("recommends authoring for Documenso signer signature field errors", () => {
		const remediation = buildDealDocumentRemediation({
			...baseInput,
			lastError:
				"Documenso signer recipients must have at least one SIGNATURE field",
		});

		expect(remediation.eligibility).toBe("remediable_failed_instance");
		expect(remediation.primaryAction).toBe("open_authoring");
		expect(remediation.summary).toContain("signature field");
		expect(remediation.actions.map((action) => action.action)).toEqual([
			"open_authoring",
			"open_mapping",
			"retry_instance",
			"refresh_snapshot",
			"waive_for_deal",
			"archive_source_blueprint",
		]);
	});

	it("recommends recipient mapping for missing signatory mappings", () => {
		const remediation = buildDealDocumentRemediation({
			...baseInput,
			lastError:
				"Signatory mapping validation failed: no participant maps to lawyer_primary",
			status: "signature_pending_recipient_resolution",
		});

		expect(remediation.primaryAction).toBe("open_mapping");
		expect(remediation.summary).toContain("recipient mapping");
		expect(remediation.actions[0]?.copy).toContain("recipient");
	});

	it("marks signed documents ineligible", () => {
		expect(
			getDealDocumentRemediationEligibility({
				...baseInput,
				status: "signed",
			})
		).toBe("not_remediable");
	});

	it("marks waived rows as already remediated", () => {
		expect(
			getDealDocumentRemediationEligibility({
				...baseInput,
				remediationAction: "waived_for_deal",
			})
		).toBe("already_remediated");
	});

	it("marks archived rows ineligible", () => {
		expect(
			getDealDocumentRemediationEligibility({
				...baseInput,
				archivedAt: Date.now(),
			})
		).toBe("not_remediable");
	});
});
