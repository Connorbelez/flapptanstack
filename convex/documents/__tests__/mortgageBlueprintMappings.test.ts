import { v } from "convex/values";
import { describe, expect, it } from "vitest";
import type { Id } from "../../_generated/dataModel";
import {
	ALLOWED_MORTGAGE_SIGNATORY_PLATFORM_ROLES,
	type MortgageDocumentMappingOverrides,
	mortgageDocumentMappingOverridesValidator,
	mortgageDocumentSignatoryMappingOverrideValidator,
	mortgageDocumentVariableMappingOverrideValidator,
	SUPPORTED_MORTGAGE_DOCUMENT_VARIABLE_KEYS,
} from "../contracts";
import {
	buildEnvelopeRecipientRows,
	toDealPackageBlueprintSnapshot,
} from "../dealPackages";
import {
	buildBlueprintMatchKey,
	buildEffectiveMortgageDocumentMappings,
	buildMortgageTemplateClassCompatibility,
	buildOverrideAwareMortgageDocumentValidationSummary,
	buildPreviewMortgageDocumentMappingSummary,
	resolveReplacementMappingOverrides,
	validateMortgageDocumentMappingOverrides,
} from "../mortgageBlueprints";

type TemplateSnapshot = Parameters<
	typeof buildOverrideAwareMortgageDocumentValidationSummary
>[0]["snapshot"];

interface ValidatorJson {
	readonly type: string;
	readonly value?: unknown;
}

interface ObjectFieldJson {
	readonly fieldType: ValidatorJson;
	readonly optional: boolean;
}

function assertValidatorAccepts(
	value: MortgageDocumentMappingOverrides
): MortgageDocumentMappingOverrides {
	const validator = v.object({
		mappingOverrides: mortgageDocumentMappingOverridesValidator,
	});
	expect(validator).toBeDefined();
	return value;
}

function getObjectFieldType(
	validator: { readonly json: unknown },
	fieldName: string
): ValidatorJson {
	const json = validator.json;
	expect(isRecord(json)).toBe(true);
	const value = (json as { readonly value?: unknown }).value;
	expect(isRecord(value)).toBe(true);
	const field = (value as Record<string, unknown>)[fieldName];
	expect(isObjectFieldJson(field)).toBe(true);
	return field.fieldType;
}

function getLiteralUnionValues(validatorJson: ValidatorJson) {
	expect(validatorJson.type).toBe("union");
	expect(Array.isArray(validatorJson.value)).toBe(true);
	return (validatorJson.value as readonly unknown[]).map((member) => {
		expect(isRecord(member)).toBe(true);
		expect(member.type).toBe("literal");
		expect(typeof member.value).toBe("string");
		return member.value;
	});
}

function isObjectFieldJson(value: unknown): value is ObjectFieldJson {
	if (!isRecord(value)) {
		return false;
	}
	return isRecord(value.fieldType) && typeof value.optional === "boolean";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function buildTemplateSnapshot(args: {
	platformRole?: string;
	signable?: boolean;
	variableKey: string;
}): TemplateSnapshot {
	return {
		fields: [
			{
				id: "principal-field",
				position: { height: 20, page: 1, width: 120, x: 10, y: 10 },
				type: "interpolable",
				variableKey: args.variableKey,
			},
			...(args.signable
				? [
						{
							id: "signature-field",
							position: { height: 20, page: 1, width: 120, x: 10, y: 40 },
							signableType: "SIGNATURE" as const,
							signatoryPlatformRole: args.platformRole ?? "borrower_primary",
							type: "signable" as const,
						},
					]
				: []),
		],
		signatories: args.signable
			? [
					{
						order: 1,
						platformRole: args.platformRole ?? "borrower_primary",
						role: "signatory",
					},
				]
			: [],
	};
}

describe("mortgage document mapping override contracts", () => {
	it("models variable and signatory overrides separately", () => {
		const overrides = assertValidatorAccepts({
			signatories: [
				{
					dealParticipantRole: "primary_borrower",
					templatePlatformRole: "borrower_primary",
				},
			],
			variables: [
				{
					dealVariableKey: "mortgage_principal",
					templateVariableKey: "principal_amount",
				},
			],
		});

		expect(overrides.variables[0]?.templateVariableKey).toBe(
			"principal_amount"
		);
		expect(overrides.signatories[0]?.dealParticipantRole).toBe(
			"primary_borrower"
		);
	});

	it("constrains deal-side variable targets to supported mortgage keys", () => {
		const dealVariableKeyValidator = getObjectFieldType(
			mortgageDocumentVariableMappingOverrideValidator,
			"dealVariableKey"
		);
		const supportedTargets = getLiteralUnionValues(dealVariableKeyValidator);

		expect(supportedTargets).toContain("primary_lawyer_email");
		expect(supportedTargets).toContain("purchasing_lender_full_name");
		expect(supportedTargets).toContain("mortgage_principal");
		expect(supportedTargets).toContain("property_street_address");
		expect(supportedTargets).not.toContain("lawyer_primary_email");
		expect(supportedTargets).not.toContain("lender_primary_full_name");
		expect(supportedTargets).not.toContain("principal_amount");
		expect(supportedTargets).not.toContain("unknown_variable");
		expect(supportedTargets).toEqual([
			...SUPPORTED_MORTGAGE_DOCUMENT_VARIABLE_KEYS,
		]);
	});

	it("constrains deal-side signatory targets to supported mortgage roles", () => {
		const dealParticipantRoleValidator = getObjectFieldType(
			mortgageDocumentSignatoryMappingOverrideValidator,
			"dealParticipantRole"
		);
		const supportedTargets = getLiteralUnionValues(
			dealParticipantRoleValidator
		);

		expect(supportedTargets).toContain("primary_borrower");
		expect(supportedTargets).toContain("purchasing_lender");
		expect(supportedTargets).not.toContain("borrower_primary");
		expect(supportedTargets).not.toContain("borrower_signer");
		expect(supportedTargets).not.toContain("unknown_role");
		expect(supportedTargets).toEqual([
			...ALLOWED_MORTGAGE_SIGNATORY_PLATFORM_ROLES,
		]);
	});
});

describe("mortgage blueprint mapping validation", () => {
	it("rejects duplicate variable override rows", () => {
		expect(() =>
			validateMortgageDocumentMappingOverrides({
				allowedPlatformRoles: ["primary_borrower"],
				allowedVariableKeys: ["mortgage_principal"],
				mappingOverrides: {
					signatories: [],
					variables: [
						{
							dealVariableKey: "mortgage_principal",
							templateVariableKey: "principal_amount",
						},
						{
							dealVariableKey: "mortgage_principal",
							templateVariableKey: "principal_amount",
						},
					],
				},
				requiredPlatformRoles: [],
				requiredVariableKeys: ["principal_amount"],
			})
		).toThrow("Duplicate variable mapping override");
	});

	it("rejects unsupported variable targets", () => {
		const unsupportedVariableTarget =
			"unknown_variable" as MortgageDocumentMappingOverrides["variables"][number]["dealVariableKey"];

		expect(() =>
			validateMortgageDocumentMappingOverrides({
				allowedPlatformRoles: ["primary_borrower"],
				allowedVariableKeys: ["mortgage_principal"],
				mappingOverrides: {
					signatories: [],
					variables: [
						{
							dealVariableKey: unsupportedVariableTarget,
							templateVariableKey: "principal_amount",
						},
					],
				},
				requiredPlatformRoles: ["borrower_primary"],
				requiredVariableKeys: ["principal_amount"],
			})
		).toThrow("Unsupported variable mapping target");
	});

	it("rejects unsupported signatory targets", () => {
		const unsupportedSignatoryTarget =
			"unknown_role" as MortgageDocumentMappingOverrides["signatories"][number]["dealParticipantRole"];

		expect(() =>
			validateMortgageDocumentMappingOverrides({
				allowedPlatformRoles: ["primary_borrower"],
				allowedVariableKeys: ["mortgage_principal"],
				mappingOverrides: {
					signatories: [
						{
							dealParticipantRole: unsupportedSignatoryTarget,
							templatePlatformRole: "borrower_primary",
						},
					],
					variables: [],
				},
				requiredPlatformRoles: ["borrower_primary"],
				requiredVariableKeys: ["principal_amount"],
			})
		).toThrow("Unsupported signatory mapping target");
	});

	it("builds defaults plus explicit overrides into effective mappings", () => {
		const effective = buildEffectiveMortgageDocumentMappings({
			mappingOverrides: {
				signatories: [
					{
						dealParticipantRole: "primary_borrower",
						templatePlatformRole: "custom_borrower",
					},
				],
				variables: [
					{
						dealVariableKey: "mortgage_principal",
						templateVariableKey: "custom_principal",
					},
				],
			},
			requiredPlatformRoles: ["borrower_primary", "custom_borrower"],
			requiredVariableKeys: ["mortgage_principal", "custom_principal"],
		});

		expect(effective.variables).toEqual([
			{
				dealVariableKey: "mortgage_principal",
				templateVariableKey: "mortgage_principal",
			},
			{
				dealVariableKey: "mortgage_principal",
				templateVariableKey: "custom_principal",
			},
		]);
		expect(effective.signatories).toEqual([
			{
				dealParticipantRole: "primary_borrower",
				templatePlatformRole: "borrower_primary",
			},
			{
				dealParticipantRole: "primary_borrower",
				templatePlatformRole: "custom_borrower",
			},
		]);
	});

	it("validates custom template placeholders after applying overrides", () => {
		const validationSummary =
			buildOverrideAwareMortgageDocumentValidationSummary({
				documentClass: "private_templated_signable",
				mappingOverrides: {
					signatories: [
						{
							dealParticipantRole: "primary_borrower",
							templatePlatformRole: "custom_borrower",
						},
					],
					variables: [
						{
							dealVariableKey: "mortgage_principal",
							templateVariableKey: "custom_principal",
						},
					],
				},
				snapshot: buildTemplateSnapshot({
					platformRole: "custom_borrower",
					signable: true,
					variableKey: "custom_principal",
				}),
			});

		expect(validationSummary.requiredPlatformRoles).toEqual([
			"custom_borrower",
		]);
		expect(validationSummary.requiredVariableKeys).toEqual([
			"custom_principal",
		]);
		expect(validationSummary.unsupportedPlatformRoles).toEqual([]);
		expect(validationSummary.unsupportedVariableKeys).toEqual([]);
	});

	it("previews unsupported custom placeholders without requiring overrides first", () => {
		const previewSummary = buildPreviewMortgageDocumentMappingSummary({
			documentClass: "private_templated_signable",
			snapshot: buildTemplateSnapshot({
				platformRole: "custom_borrower",
				signable: true,
				variableKey: "custom_principal",
			}),
		});

		expect(previewSummary.validationSummary.requiredPlatformRoles).toEqual([
			"custom_borrower",
		]);
		expect(previewSummary.validationSummary.requiredVariableKeys).toEqual([
			"custom_principal",
		]);
		expect(previewSummary.validationSummary.unsupportedPlatformRoles).toEqual([
			"custom_borrower",
		]);
		expect(previewSummary.validationSummary.unsupportedVariableKeys).toEqual([
			"custom_principal",
		]);
		expect(previewSummary.effectiveMappings.signatories).toEqual([
			{
				dealParticipantRole: "custom_borrower",
				templatePlatformRole: "custom_borrower",
			},
		]);
		expect(previewSummary.effectiveMappings.variables).toEqual([
			{
				dealVariableKey: "custom_principal",
				templateVariableKey: "custom_principal",
			},
		]);
	});

	it("marks signable templates incompatible with read-only source selection", () => {
		const compatibility = buildMortgageTemplateClassCompatibility(
			buildTemplateSnapshot({
				platformRole: "borrower_primary",
				signable: true,
				variableKey: "mortgage_principal",
			})
		);

		expect(compatibility.private_templated_non_signable.compatible).toBe(false);
		expect(compatibility.private_templated_non_signable.reason).toBe(
			"Signable templates cannot be attached as read-only documents."
		);
		expect(compatibility.private_templated_signable.compatible).toBe(true);
	});

	it("marks non-signable templates incompatible with signable source selection", () => {
		const compatibility = buildMortgageTemplateClassCompatibility(
			buildTemplateSnapshot({
				variableKey: "mortgage_principal",
			})
		);

		expect(compatibility.private_templated_non_signable.compatible).toBe(true);
		expect(compatibility.private_templated_signable.compatible).toBe(false);
		expect(compatibility.private_templated_signable.reason).toBe(
			"Signable templates must contain at least one signable field."
		);
	});

	it("preserves replacement overrides when omitted and clears explicit empty overrides", () => {
		const existingOverrides: MortgageDocumentMappingOverrides = {
			signatories: [
				{
					dealParticipantRole: "primary_borrower",
					templatePlatformRole: "custom_borrower",
				},
			],
			variables: [
				{
					dealVariableKey: "mortgage_principal",
					templateVariableKey: "custom_principal",
				},
			],
		};
		const emptyOverrides: MortgageDocumentMappingOverrides = {
			signatories: [],
			variables: [],
		};

		expect(
			resolveReplacementMappingOverrides({
				existingMappingOverrides: existingOverrides,
			})
		).toBe(existingOverrides);
		expect(
			resolveReplacementMappingOverrides({
				existingMappingOverrides: existingOverrides,
				mappingOverrides: emptyOverrides,
			})
		).toBe(emptyOverrides);
	});

	it("includes canonical mapping overrides in blueprint match keys", () => {
		const baseArgs = {
			class: "private_templated_signable" as const,
			displayName: "Closing package",
			templateVersion: 3,
		};
		const overrides = {
			signatories: [
				{
					dealParticipantRole: "primary_borrower" as const,
					templatePlatformRole: "custom_borrower",
				},
				{
					dealParticipantRole: "broker_of_record" as const,
					templatePlatformRole: "custom_broker",
				},
			],
			variables: [
				{
					dealVariableKey: "mortgage_principal" as const,
					templateVariableKey: "custom_principal",
				},
				{
					dealVariableKey: "property_city" as const,
					templateVariableKey: "custom_city",
				},
			],
		};
		const reorderedOverrides: MortgageDocumentMappingOverrides = {
			signatories: [...overrides.signatories].reverse(),
			variables: [...overrides.variables].reverse(),
		};
		const differentOverrides: MortgageDocumentMappingOverrides = {
			signatories: overrides.signatories,
			variables: [
				{
					dealVariableKey: "mortgage_amount",
					templateVariableKey: "custom_principal",
				},
				overrides.variables[1],
			],
		};

		expect(
			buildBlueprintMatchKey({
				...baseArgs,
				mappingOverrides: { signatories: [], variables: [] },
			})
		).toBe(buildBlueprintMatchKey(baseArgs));
		expect(
			buildBlueprintMatchKey({ ...baseArgs, mappingOverrides: overrides })
		).toBe(
			buildBlueprintMatchKey({
				...baseArgs,
				mappingOverrides: reorderedOverrides,
			})
		);
		expect(
			buildBlueprintMatchKey({ ...baseArgs, mappingOverrides: overrides })
		).not.toBe(
			buildBlueprintMatchKey({
				...baseArgs,
				mappingOverrides: differentOverrides,
			})
		);
	});
});

describe("deal package blueprint mapping snapshots", () => {
	it("copies mapping overrides into the immutable deal package snapshot", () => {
		const snapshot = toDealPackageBlueprintSnapshot({
			_id: "blueprint_test" as Id<"mortgageDocumentBlueprints">,
			assetId: undefined,
			category: undefined,
			class: "private_templated_non_signable",
			description: "Funding notice",
			displayName: "Funding notice",
			displayOrder: 1,
			mappingOverrides: {
				signatories: [],
				variables: [
					{
						dealVariableKey: "mortgage_principal",
						templateVariableKey: "principal_amount",
					},
				],
			},
			packageKey: undefined,
			packageLabel: undefined,
			templateId: "template_test" as Id<"documentTemplates">,
			templateVersion: 2,
		});

		expect(snapshot.sourceBlueprintSnapshot.mappingOverrides).toEqual({
			signatories: [],
			variables: [
				{
					dealVariableKey: "mortgage_principal",
					templateVariableKey: "principal_amount",
				},
			],
		});
	});
});

describe("deal package signatory mapping recipient attribution", () => {
	it("attributes custom alias signatories to the mapped borrower participant", () => {
		const borrowerUserId = "user_borrower" as Id<"users">;

		const rows = buildEnvelopeRecipientRows({
			createEnvelopeResult: {
				providerEnvelopeId: "env_test",
				recipients: [
					{
						platformRole: "custom_borrower",
						providerRecipientId: "recipient_custom_borrower",
					},
				],
				status: "draft",
			},
			runtime: {
				dealId: "deal_test" as Id<"deals">,
				mortgageId: "mortgage_test" as Id<"mortgages">,
				packageId: "package_test" as Id<"dealDocumentPackages">,
				signatories: [],
				signatoryParticipants: [
					{
						email: "borrower@example.test",
						name: "Borrower User",
						platformRole: "primary_borrower",
						userId: borrowerUserId,
					},
				],
				variables: {},
			},
			signatureRecipients: [
				{
					email: "borrower@example.test",
					fields: [],
					name: "Borrower User",
					platformRole: "custom_borrower",
					providerRole: "SIGNER",
					signingOrder: 1,
				},
			],
		});

		expect(rows[0]?.userId).toBe(borrowerUserId);
	});

	it("attributes remapped legacy template roles to the mapped participant", () => {
		const borrowerUserId = "user_borrower" as Id<"users">;
		const brokerUserId = "user_broker" as Id<"users">;

		const rows = buildEnvelopeRecipientRows({
			createEnvelopeResult: {
				providerEnvelopeId: "env_test",
				recipients: [
					{
						platformRole: "borrower_primary",
						providerRecipientId: "recipient_broker_as_borrower",
					},
				],
				status: "draft",
			},
			runtime: {
				dealId: "deal_test" as Id<"deals">,
				mortgageId: "mortgage_test" as Id<"mortgages">,
				packageId: "package_test" as Id<"dealDocumentPackages">,
				signatories: [],
				signatoryParticipants: [
					{
						email: "borrower@example.test",
						name: "Borrower User",
						platformRole: "primary_borrower",
						userId: borrowerUserId,
					},
					{
						email: "broker@example.test",
						name: "Broker User",
						platformRole: "broker_of_record",
						userId: brokerUserId,
					},
				],
				variables: {},
			},
			signatureRecipients: [
				{
					email: "broker@example.test",
					fields: [],
					name: "Broker User",
					platformRole: "borrower_primary",
					providerRole: "SIGNER",
					signingOrder: 1,
				},
			],
		});

		expect(rows[0]?.userId).toBe(brokerUserId);
		expect(rows[0]?.userId).not.toBe(borrowerUserId);
	});
});
