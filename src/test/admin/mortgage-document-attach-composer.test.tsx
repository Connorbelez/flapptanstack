/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation, useQuery } from "convex/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MortgageFilesDocumentAttachButton } from "#/components/admin/mortgages/MortgageFilesDocumentAttachButton";
import { Sheet, SheetContent } from "#/components/ui/sheet";
import { api } from "../../../convex/_generated/api";

vi.mock("react", async () => {
	const { createRequire } =
		await vi.importActual<typeof import("node:module")>("node:module");
	const require = createRequire(import.meta.url);
	const reactCjs = require("react") as typeof import("react");
	return {
		...reactCjs,
		default: reactCjs,
	};
});

vi.mock("convex/react", () => ({
	useAction: vi.fn(),
	useMutation: vi.fn(),
	useQuery: vi.fn(),
}));

const useQueryMock = useQuery as unknown as ReturnType<typeof vi.fn>;
const useMutationMock = useMutation as unknown as ReturnType<typeof vi.fn>;
const attachTemplateVersionMock = vi.fn();

const templates = [
	{
		compatibility: {
			private_templated_non_signable: {
				compatible: true,
			},
			private_templated_signable: {
				compatible: false,
				reason: "Signable templates must contain at least one signable field.",
			},
		},
		currentPublishedVersion: 1,
		description: "Maps custom placeholders",
		name: "Funding Notice",
		templateId: "template_funding_notice",
	},
	{
		compatibility: {
			private_templated_non_signable: {
				compatible: true,
			},
			private_templated_signable: {
				compatible: false,
				reason: "Signable templates must contain at least one signable field.",
			},
		},
		currentPublishedVersion: 2,
		description: "Maps alternate placeholders",
		name: "Servicing Notice",
		templateId: "template_servicing_notice",
	},
	{
		compatibility: {
			private_templated_non_signable: {
				compatible: false,
				reason: "Signable templates cannot be attached as read-only documents.",
			},
			private_templated_signable: {
				compatible: true,
			},
		},
		currentPublishedVersion: 3,
		description: "Requires signatures",
		name: "Signing Notice",
		templateId: "template_signing_notice",
	},
];

const previewRowsByTemplate = {
	template_funding_notice: {
		platformRole: "borrower_signer",
		variableKey: "principal_amount",
	},
	template_servicing_notice: {
		platformRole: "broker_signer",
		variableKey: "servicing_amount",
	},
};

beforeEach(() => {
	if (!Element.prototype.hasPointerCapture) {
		Element.prototype.hasPointerCapture = vi.fn();
	}
	if (!Element.prototype.setPointerCapture) {
		Element.prototype.setPointerCapture = vi.fn();
	}
	if (!Element.prototype.releasePointerCapture) {
		Element.prototype.releasePointerCapture = vi.fn();
	}
	if (!Element.prototype.scrollIntoView) {
		Element.prototype.scrollIntoView = vi.fn();
	}
});

function setupDocumentQueries() {
	useQueryMock.mockImplementation((query, args) => {
		if (
			args !== "skip" &&
			typeof args === "object" &&
			args !== null &&
			"templateId" in args
		) {
			const previewRows =
				previewRowsByTemplate[
					args.templateId as keyof typeof previewRowsByTemplate
				] ?? previewRowsByTemplate.template_funding_notice;
			if (
				args.class === "private_templated_non_signable" &&
				args.templateId === "template_signing_notice"
			) {
				throw new Error("Preview should not be called for incompatible template");
			}
			if (
				args.class === "private_templated_signable" &&
				args.templateId === "template_funding_notice"
			) {
				throw new Error("Preview should not be called for incompatible template");
			}
			return {
				effectiveMappings: {
					signatories: [
						{
							dealParticipantRole:
								args.mappingOverrides.signatories[0]?.dealParticipantRole ??
								previewRows.platformRole,
							templatePlatformRole: previewRows.platformRole,
						},
					],
					variables: [
						{
							dealVariableKey:
								args.mappingOverrides.variables[0]?.dealVariableKey ??
								previewRows.variableKey,
							templateVariableKey: previewRows.variableKey,
						},
					],
				},
				templateName:
					args.templateId === "template_servicing_notice"
						? "Servicing Notice"
						: "Funding Notice",
				templateVersion: 1,
				validationSummary: {
					containsSignableFields: false,
					requiredPlatformRoles: [previewRows.platformRole],
					requiredVariableKeys: [previewRows.variableKey],
					unsupportedPlatformRoles: args.mappingOverrides.signatories.length
						? []
						: [previewRows.platformRole],
					unsupportedVariableKeys: args.mappingOverrides.variables.length
						? []
						: [previewRows.variableKey],
				},
			};
		}
		if (args !== "skip") {
			return templates;
		}
		return undefined;
	});
	useMutationMock.mockReturnValue(attachTemplateVersionMock);
}

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("MortgageFilesDocumentAttachButton", () => {
	it("opens the row-based document attach composer", async () => {
		render(<MortgageFilesDocumentAttachButton mortgageId="mortgage_test" />);

		await userEvent.click(screen.getByRole("button", { name: /attach document/i }));

		expect(screen.getByRole("dialog")).toBeTruthy();
		expect(
			screen.getByRole("radiogroup", { name: /document type/i })
		).toBeTruthy();
		expect(screen.getByText("Document type")).toBeTruthy();
		expect(screen.getByLabelText("Public static PDF/doc")).toBeTruthy();
		expect(screen.getByLabelText("Private templated read-only")).toBeTruthy();
		expect(screen.getByLabelText("Private signable template")).toBeTruthy();
	});

	it("opens the template selector when the composer is launched from the detail sheet", async () => {
		setupDocumentQueries();

		render(
			<Sheet open>
				<SheetContent>
					<MortgageFilesDocumentAttachButton mortgageId="mortgage_test" />
				</SheetContent>
			</Sheet>
		);

		await userEvent.click(screen.getByRole("button", { name: /attach document/i }));
		await userEvent.click(screen.getByLabelText("Private templated read-only"));
		await userEvent.click(screen.getByRole("combobox", { name: "Template" }));

		expect(
			screen.getByRole("option", { name: "Funding Notice v1" })
		).toBeTruthy();
	});

	it("maps custom template placeholders, resets overrides, and submits them", async () => {
		setupDocumentQueries();
		attachTemplateVersionMock.mockResolvedValue({ blueprintId: "blueprint_test" });

		render(<MortgageFilesDocumentAttachButton mortgageId="mortgage_test" />);
		await userEvent.click(screen.getByRole("button", { name: /attach document/i }));
		await userEvent.click(screen.getByLabelText("Private templated read-only"));
		await userEvent.click(screen.getByRole("combobox", { name: "Template" }));
		await userEvent.click(
			screen.getByRole("option", { name: "Funding Notice v1" })
		);

		expect(screen.getByText("principal_amount")).toBeTruthy();
		expect(screen.getByText("borrower_signer")).toBeTruthy();
		expect(screen.getAllByText("Unresolved. Choose a mapping.")).toHaveLength(2);
		expect(
			screen.getByRole("button", { name: /reset principal_amount/i })
		).toBeTruthy();
		expect(document.querySelector(".card")).toBeNull();

		await userEvent.click(
			screen.getByRole("combobox", { name: "Mapping for principal_amount" })
		);
		await userEvent.click(
			screen.getByRole("option", { name: "mortgage_principal" })
		);
		expect(screen.getAllByText("Unresolved. Choose a mapping.")).toHaveLength(1);

		await userEvent.click(
			screen.getByRole("button", { name: /reset principal_amount/i })
		);
		expect(screen.getAllByText("Unresolved. Choose a mapping.")).toHaveLength(2);

		await userEvent.click(
			screen.getByRole("combobox", { name: "Mapping for principal_amount" })
		);
		await userEvent.click(
			screen.getByRole("option", { name: "mortgage_principal" })
		);
		await userEvent.click(
			screen.getByRole("combobox", { name: "Mapping for borrower_signer" })
		);
		await userEvent.click(screen.getByRole("option", { name: "primary_borrower" }));
		await userEvent.click(screen.getByRole("button", { name: "Review" }));
		await userEvent.click(
			screen.getByRole("button", { name: /attach future-only document/i })
		);

		expect(attachTemplateVersionMock).toHaveBeenCalledWith({
			class: "private_templated_non_signable",
			description: undefined,
			displayName: undefined,
			mappingOverrides: {
				signatories: [
					{
						dealParticipantRole: "primary_borrower",
						templatePlatformRole: "borrower_signer",
					},
				],
				variables: [
					{
						dealVariableKey: "mortgage_principal",
						templateVariableKey: "principal_amount",
					},
				],
			},
			mortgageId: "mortgage_test",
			templateId: "template_funding_notice",
		});
	}, 10_000);

	it("clears stale mapping overrides when changing templates", async () => {
		setupDocumentQueries();
		attachTemplateVersionMock.mockResolvedValue({ blueprintId: "blueprint_test" });

		render(<MortgageFilesDocumentAttachButton mortgageId="mortgage_test" />);
		await userEvent.click(screen.getByRole("button", { name: /attach document/i }));
		await userEvent.click(screen.getByLabelText("Private templated read-only"));
		await userEvent.click(screen.getByRole("combobox", { name: "Template" }));
		await userEvent.click(
			screen.getByRole("option", { name: "Funding Notice v1" })
		);
		await userEvent.click(
			screen.getByRole("combobox", { name: "Mapping for principal_amount" })
		);
		await userEvent.click(
			screen.getByRole("option", { name: "mortgage_principal" })
		);
		await userEvent.click(
			screen.getByRole("combobox", { name: "Mapping for borrower_signer" })
		);
		await userEvent.click(screen.getByRole("option", { name: "primary_borrower" }));

		await userEvent.click(screen.getByRole("combobox", { name: "Template" }));
		await userEvent.click(
			screen.getByRole("option", { name: "Servicing Notice v2" })
		);

		expect(screen.getByText("servicing_amount")).toBeTruthy();
		expect(screen.getByText("broker_signer")).toBeTruthy();
		expect(screen.getAllByText("Unresolved. Choose a mapping.")).toHaveLength(2);

		await userEvent.click(
			screen.getByRole("combobox", { name: "Mapping for servicing_amount" })
		);
		await userEvent.click(
			screen.getByRole("option", { name: "mortgage_principal" })
		);
		await userEvent.click(
			screen.getByRole("combobox", { name: "Mapping for broker_signer" })
		);
		await userEvent.click(screen.getByRole("option", { name: "assigned_broker" }));
		await userEvent.click(screen.getByRole("button", { name: "Review" }));
		await userEvent.click(
			screen.getByRole("button", { name: /attach future-only document/i })
		);

		expect(attachTemplateVersionMock).toHaveBeenCalledWith({
			class: "private_templated_non_signable",
			description: undefined,
			displayName: undefined,
			mappingOverrides: {
				signatories: [
					{
						dealParticipantRole: "assigned_broker",
						templatePlatformRole: "broker_signer",
					},
				],
				variables: [
					{
						dealVariableKey: "mortgage_principal",
						templateVariableKey: "servicing_amount",
					},
				],
			},
			mortgageId: "mortgage_test",
			templateId: "template_servicing_notice",
		});
	}, 10_000);

	it("blocks review while required mappings are unresolved", async () => {
		setupDocumentQueries();

		render(<MortgageFilesDocumentAttachButton mortgageId="mortgage_test" />);
		await userEvent.click(screen.getByRole("button", { name: /attach document/i }));
		await userEvent.click(screen.getByLabelText("Private templated read-only"));
		await userEvent.click(screen.getByRole("combobox", { name: "Template" }));
		await userEvent.click(
			screen.getByRole("option", { name: "Funding Notice v1" })
		);

		expect(
			screen.getByText(
				"Resolve all required variable and signatory mappings before review."
			)
		).toBeTruthy();
		expect(
			(screen.getByRole("button", { name: "Review" }) as HTMLButtonElement)
				.disabled
		).toBe(true);
		expect(
			screen.queryByRole("button", { name: /attach future-only document/i })
		).toBeNull();
		expect(attachTemplateVersionMock).not.toHaveBeenCalled();
	});

	it("disables signable templates for read-only attachment selection", async () => {
		setupDocumentQueries();

		render(<MortgageFilesDocumentAttachButton mortgageId="mortgage_test" />);
		await userEvent.click(screen.getByRole("button", { name: /attach document/i }));
		await userEvent.click(screen.getByLabelText("Private templated read-only"));
		await userEvent.click(screen.getByRole("combobox", { name: "Template" }));

		const disabledOption = screen.getByRole("option", {
			name: /Signing Notice v3 Signable templates cannot be attached as read-only documents/i,
		});
		expect(disabledOption.getAttribute("aria-disabled")).toBe("true");
		expect(screen.queryByText("Signing Notice v3", { exact: true })).toBeNull();
		expect(screen.queryByText("Signing Notice v3")).toBeNull();
	});

	it("disables non-signable templates for signable attachment selection", async () => {
		setupDocumentQueries();

		render(<MortgageFilesDocumentAttachButton mortgageId="mortgage_test" />);
		await userEvent.click(screen.getByRole("button", { name: /attach document/i }));
		await userEvent.click(screen.getByLabelText("Private signable template"));
		await userEvent.click(screen.getByRole("combobox", { name: "Template" }));

		const disabledOption = screen.getByRole("option", {
			name: /Funding Notice v1 Signable templates must contain at least one signable field/i,
		});
		expect(disabledOption.getAttribute("aria-disabled")).toBe("true");
		expect(
			screen.getByRole("option", { name: "Signing Notice v3" }).getAttribute(
				"aria-disabled"
			)
		).not.toBe("true");
	});
});
