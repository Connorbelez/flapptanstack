# Mortgage Post-Origination Document Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mortgage Files-tab guided composer that lets admins attach future-only public static, private interpolable, and private signable mortgage document blueprints after origination.

**Architecture:** Extend the existing mortgage document blueprint model with blueprint-scoped mapping overrides, validate those overrides in Convex, and resolve them during future deal package materialization. Add a row/form-based Files-tab composer that consumes published document engine templates and existing document asset upload plumbing without duplicating template authoring.

**Tech Stack:** Convex, fluent-convex, React, TanStack Router, ShadCN UI primitives, Vitest, React Testing Library, Playwright, Bun, Biome.

---

## File Structure

- Modify `convex/documents/contracts.ts`: add mapping override validators/types and include overrides in deal package blueprint snapshots.
- Modify `convex/schema.ts`: add optional `mappingOverrides` to `mortgageDocumentBlueprints`.
- Modify `convex/documents/mortgageBlueprints.ts`: add mapping preview/validation helpers, expose attachable template query for mortgage admins, and accept mapping overrides in template attach/replace flows.
- Modify `convex/documents/dealPackages.ts`: resolve effective mappings from blueprint snapshots and use them while building variables/signatories for generated package instances.
- Create `convex/documents/__tests__/mortgageBlueprintMappings.test.ts`: backend TDD for override validation, persistence, snapshotting, and future-only package behavior.
- Create `src/components/admin/mortgages/MortgageDocumentMappingEditor.tsx`: focused row/table editor for variable and signatory overrides.
- Create `src/components/admin/mortgages/MortgageDocumentAttachComposer.tsx`: guided drawer/dialog for document type, source, mappings, and review.
- Create `src/components/admin/mortgages/MortgageFilesDocumentAttachButton.tsx`: Files-tab entry point.
- Modify `src/components/admin/shell/RecordAttachmentsPanel.tsx`: accept an optional `afterHeaderAction` or `renderHeaderActions` prop so entity adapters can add the mortgage document attach button under Files without forking attachment upload UI.
- Modify `src/components/admin/shell/entity-view-adapters.tsx`: override `mortgages.renderFilesTab` to render `RecordAttachmentsPanel` plus `MortgageFilesDocumentAttachButton`.
- Create `src/test/admin/mortgage-document-attach-composer.test.tsx`: component tests for composer and mapping editor behavior.
- Create `e2e/admin/mortgage-document-attachments.spec.ts`: Playwright coverage for all three attachment classes.

Before editing functions/classes in implementation, run GitNexus impact analysis on the target symbols required by workspace rules:

```bash
npx gitnexus impact --target insertBlueprint --direction upstream
npx gitnexus impact --target attachTemplateVersion --direction upstream
npx gitnexus impact --target replaceTemplateBlueprint --direction upstream
npx gitnexus impact --target RecordAttachmentsPanel --direction upstream
```

If GitNexus reports HIGH or CRITICAL risk, pause and report the blast radius before editing.

## Task 1: Backend Mapping Contracts

**Files:**
- Modify: `convex/documents/contracts.ts`
- Modify: `convex/schema.ts`
- Test: `convex/documents/__tests__/mortgageBlueprintMappings.test.ts`

- [ ] **Step 1: Write the failing contract test**

Create `convex/documents/__tests__/mortgageBlueprintMappings.test.ts` with a focused validator test that proves mapping overrides are part of the public contract.

```ts
import { describe, expect, it } from "vitest";
import { v } from "convex/values";
import {
	mortgageDocumentMappingOverridesValidator,
	type MortgageDocumentMappingOverrides,
} from "../contracts";

function assertValidatorAccepts(
	value: MortgageDocumentMappingOverrides
): MortgageDocumentMappingOverrides {
	const validator = v.object({
		mappingOverrides: mortgageDocumentMappingOverridesValidator,
	});
	expect(validator).toBeDefined();
	return value;
}

describe("mortgage document mapping override contracts", () => {
	it("models variable and signatory overrides separately", () => {
		const overrides = assertValidatorAccepts({
			signatories: [
				{
					dealParticipantRole: "borrower_primary",
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
			"borrower_primary"
		);
	});
});
```

- [ ] **Step 2: Run the contract test and confirm it fails**

Run:

```bash
bun run test convex/documents/__tests__/mortgageBlueprintMappings.test.ts
```

Expected: FAIL because `mortgageDocumentMappingOverridesValidator` is not exported.

- [ ] **Step 3: Add mapping override validators and types**

In `convex/documents/contracts.ts`, add these exports after `mortgageDocumentValidationSummaryValidator`:

```ts
export const mortgageDocumentVariableMappingOverrideValidator = v.object({
	dealVariableKey: v.string(),
	templateVariableKey: v.string(),
});

export const mortgageDocumentSignatoryMappingOverrideValidator = v.object({
	dealParticipantRole: v.string(),
	templatePlatformRole: v.string(),
});

export const mortgageDocumentMappingOverridesValidator = v.object({
	signatories: v.array(mortgageDocumentSignatoryMappingOverrideValidator),
	variables: v.array(mortgageDocumentVariableMappingOverrideValidator),
});
```

Then add types near the existing mortgage document types:

```ts
export type MortgageDocumentMappingOverrides = Infer<
	typeof mortgageDocumentMappingOverridesValidator
>;
export type MortgageDocumentVariableMappingOverride = Infer<
	typeof mortgageDocumentVariableMappingOverrideValidator
>;
export type MortgageDocumentSignatoryMappingOverride = Infer<
	typeof mortgageDocumentSignatoryMappingOverrideValidator
>;
```

- [ ] **Step 4: Snapshot overrides into package contracts**

In `convex/documents/contracts.ts`, update `dealDocumentSourceBlueprintSnapshotValidator`:

```ts
export const dealDocumentSourceBlueprintSnapshotValidator = v.object({
	category: v.optional(v.string()),
	class: mortgageDocumentBlueprintClassValidator,
	description: v.optional(v.string()),
	displayName: v.string(),
	displayOrder: v.number(),
	mappingOverrides: v.optional(mortgageDocumentMappingOverridesValidator),
	packageKey: v.optional(v.string()),
	packageLabel: v.optional(v.string()),
	templateId: v.optional(v.id("documentTemplates")),
	templateVersion: v.optional(v.number()),
});
```

- [ ] **Step 5: Persist overrides on mortgage blueprints**

In `convex/schema.ts`, update the `mortgageDocumentBlueprints` table:

```ts
		mappingOverrides: v.optional(mortgageDocumentMappingOverridesValidator),
```

Place it after `templateSnapshotMeta` so template-related fields stay grouped.

- [ ] **Step 6: Run the contract test and schema typecheck**

Run:

```bash
bun run test convex/documents/__tests__/mortgageBlueprintMappings.test.ts
bun typecheck
```

Expected: PASS for the new test. Typecheck may fail in generated API files until `bunx convex codegen` runs; if so, run codegen after Task 2 adds the functions that consume the new field.

## Task 2: Blueprint Mapping Validation And Persistence

**Files:**
- Modify: `convex/documents/mortgageBlueprints.ts`
- Test: `convex/documents/__tests__/mortgageBlueprintMappings.test.ts`

- [ ] **Step 1: Add failing tests for validation rules**

Extend `convex/documents/__tests__/mortgageBlueprintMappings.test.ts` with pure helper tests. The helpers are exported for tests and used by mutations.

```ts
import {
	buildEffectiveMortgageDocumentMappings,
	validateMortgageDocumentMappingOverrides,
} from "../mortgageBlueprints";

describe("mortgage blueprint mapping validation", () => {
	it("rejects duplicate variable override rows", () => {
		expect(() =>
			validateMortgageDocumentMappingOverrides({
				allowedPlatformRoles: ["borrower_primary"],
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

	it("rejects unsupported variable and signatory targets", () => {
		expect(() =>
			validateMortgageDocumentMappingOverrides({
				allowedPlatformRoles: ["borrower_primary"],
				allowedVariableKeys: ["mortgage_principal"],
				mappingOverrides: {
					signatories: [
						{
							dealParticipantRole: "unknown_role",
							templatePlatformRole: "borrower_primary",
						},
					],
					variables: [
						{
							dealVariableKey: "unknown_variable",
							templateVariableKey: "principal_amount",
						},
					],
				},
				requiredPlatformRoles: ["borrower_primary"],
				requiredVariableKeys: ["principal_amount"],
			})
		).toThrow("Unsupported variable mapping target");
	});

	it("builds defaults plus explicit overrides into effective mappings", () => {
		const effective = buildEffectiveMortgageDocumentMappings({
			mappingOverrides: {
				signatories: [
					{
						dealParticipantRole: "borrower_primary",
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
			{ dealVariableKey: "mortgage_principal", templateVariableKey: "mortgage_principal" },
			{ dealVariableKey: "mortgage_principal", templateVariableKey: "custom_principal" },
		]);
		expect(effective.signatories).toEqual([
			{ dealParticipantRole: "borrower_primary", templatePlatformRole: "borrower_primary" },
			{ dealParticipantRole: "borrower_primary", templatePlatformRole: "custom_borrower" },
		]);
	});
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run:

```bash
bun run test convex/documents/__tests__/mortgageBlueprintMappings.test.ts
```

Expected: FAIL because the helper exports do not exist.

- [ ] **Step 3: Import mapping contract helpers**

In `convex/documents/mortgageBlueprints.ts`, update imports:

```ts
import {
	ALLOWED_MORTGAGE_SIGNATORY_PLATFORM_ROLES,
	SUPPORTED_MORTGAGE_DOCUMENT_VARIABLE_KEYS,
	mortgageDocumentBlueprintClassValidator,
	mortgageDocumentMappingOverridesValidator,
	type MortgageDocumentMappingOverrides,
} from "./contracts";
```

- [ ] **Step 4: Add validation and effective mapping helpers**

Add these helpers before `insertBlueprint`:

```ts
function assertUniqueRows(
	values: readonly string[],
	message: string
) {
	const seen = new Set<string>();
	for (const value of values) {
		if (seen.has(value)) {
			throw new ConvexError(message);
		}
		seen.add(value);
	}
}

export function validateMortgageDocumentMappingOverrides(args: {
	allowedPlatformRoles: readonly string[];
	allowedVariableKeys: readonly string[];
	mappingOverrides?: MortgageDocumentMappingOverrides;
	requiredPlatformRoles: readonly string[];
	requiredVariableKeys: readonly string[];
}) {
	if (!args.mappingOverrides) {
		return;
	}

	assertUniqueRows(
		args.mappingOverrides.variables.map((row) => row.templateVariableKey),
		"Duplicate variable mapping override"
	);
	assertUniqueRows(
		args.mappingOverrides.signatories.map((row) => row.templatePlatformRole),
		"Duplicate signatory mapping override"
	);

	for (const row of args.mappingOverrides.variables) {
		if (!args.requiredVariableKeys.includes(row.templateVariableKey)) {
			throw new ConvexError("Unknown template variable override");
		}
		if (!args.allowedVariableKeys.includes(row.dealVariableKey)) {
			throw new ConvexError("Unsupported variable mapping target");
		}
	}

	for (const row of args.mappingOverrides.signatories) {
		if (!args.requiredPlatformRoles.includes(row.templatePlatformRole)) {
			throw new ConvexError("Unknown template signatory override");
		}
		if (!args.allowedPlatformRoles.includes(row.dealParticipantRole)) {
			throw new ConvexError("Unsupported signatory mapping target");
		}
	}
}

export function buildEffectiveMortgageDocumentMappings(args: {
	mappingOverrides?: MortgageDocumentMappingOverrides;
	requiredPlatformRoles: readonly string[];
	requiredVariableKeys: readonly string[];
}) {
	const variableOverrides = new Map(
		(args.mappingOverrides?.variables ?? []).map((row) => [
			row.templateVariableKey,
			row.dealVariableKey,
		])
	);
	const signatoryOverrides = new Map(
		(args.mappingOverrides?.signatories ?? []).map((row) => [
			row.templatePlatformRole,
			row.dealParticipantRole,
		])
	);

	return {
		signatories: args.requiredPlatformRoles.map((templatePlatformRole) => ({
			dealParticipantRole:
				signatoryOverrides.get(templatePlatformRole) ?? templatePlatformRole,
			templatePlatformRole,
		})),
		variables: args.requiredVariableKeys.map((templateVariableKey) => ({
			dealVariableKey: variableOverrides.get(templateVariableKey) ?? templateVariableKey,
			templateVariableKey,
		})),
	};
}
```

- [ ] **Step 5: Add mapping overrides to insert args**

Update `insertBlueprint` args and insert payload:

```ts
		mappingOverrides?: MortgageDocumentMappingOverrides;
```

```ts
		mappingOverrides: args.mappingOverrides,
```

- [ ] **Step 6: Accept and validate overrides in template attach**

Update `attachTemplateVersion.input`:

```ts
		mappingOverrides: v.optional(mortgageDocumentMappingOverridesValidator),
```

After `validationSummary`, add:

```ts
		validateMortgageDocumentMappingOverrides({
			allowedPlatformRoles: ALLOWED_MORTGAGE_SIGNATORY_PLATFORM_ROLES,
			allowedVariableKeys: SUPPORTED_MORTGAGE_DOCUMENT_VARIABLE_KEYS,
			mappingOverrides: args.mappingOverrides,
			requiredPlatformRoles: validationSummary.requiredPlatformRoles,
			requiredVariableKeys: validationSummary.requiredVariableKeys,
		});
```

Pass `mappingOverrides: args.mappingOverrides` into `insertBlueprint`.

- [ ] **Step 7: Accept and validate overrides in template replacement**

Apply the same input, validation, and `insertBlueprint` changes to `replaceTemplateBlueprint`.

- [ ] **Step 8: Add an attachable templates query for the composer**

Add this query to `convex/documents/mortgageBlueprints.ts`:

```ts
export const listAttachableTemplates = blueprintQuery
	.input({})
	.handler(async (ctx) => {
		const templates = await ctx.db.query("documentTemplates").order("desc").collect();
		return templates
			.filter((template) => typeof template.currentPublishedVersion === "number")
			.map((template) => ({
				currentPublishedVersion: template.currentPublishedVersion ?? null,
				description: template.description ?? null,
				name: template.name,
				templateId: template._id,
			}));
	})
	.public();
```

- [ ] **Step 9: Add a mapping preview query**

Add this query to `convex/documents/mortgageBlueprints.ts`:

```ts
export const previewTemplateMappings = blueprintQuery
	.input({
		class: mortgageDocumentBlueprintClassValidator,
		mappingOverrides: v.optional(mortgageDocumentMappingOverridesValidator),
		templateId: v.id("documentTemplates"),
		templateVersion: v.optional(v.number()),
	})
	.handler(async (ctx, args) => {
		const templateSnapshot = await loadPinnedTemplateSnapshot(ctx, {
			templateId: args.templateId,
			templateVersion: args.templateVersion,
		});
		const validationSummary = buildMortgageDocumentValidationSummary({
			documentClass: args.class,
			snapshot: templateSnapshot.snapshot,
		});
		validateMortgageDocumentMappingOverrides({
			allowedPlatformRoles: ALLOWED_MORTGAGE_SIGNATORY_PLATFORM_ROLES,
			allowedVariableKeys: SUPPORTED_MORTGAGE_DOCUMENT_VARIABLE_KEYS,
			mappingOverrides: args.mappingOverrides,
			requiredPlatformRoles: validationSummary.requiredPlatformRoles,
			requiredVariableKeys: validationSummary.requiredVariableKeys,
		});
		return {
			effectiveMappings: buildEffectiveMortgageDocumentMappings({
				mappingOverrides: args.mappingOverrides,
				requiredPlatformRoles: validationSummary.requiredPlatformRoles,
				requiredVariableKeys: validationSummary.requiredVariableKeys,
			}),
			templateName: templateSnapshot.template.name,
			templateVersion: templateSnapshot.templateVersion,
			validationSummary,
		};
	})
	.public();
```

- [ ] **Step 10: Run backend tests and codegen**

Run:

```bash
bun run test convex/documents/__tests__/mortgageBlueprintMappings.test.ts
bunx convex codegen
bun typecheck
```

Expected: tests pass, codegen updates generated API/types, and typecheck passes or reports only unrelated existing errors.

## Task 3: Deal Package Materialization Uses Mapping Overrides

**Files:**
- Modify: `convex/documents/dealPackages.ts`
- Test: `convex/documents/__tests__/mortgageBlueprintMappings.test.ts`

- [ ] **Step 1: Add failing tests for snapshot preservation**

Extend the backend test with a pure snapshot test for the conversion helper. If the existing snapshot builder is not exported, extract and export a small helper named `toDealPackageBlueprintSnapshot`.

```ts
import { toDealPackageBlueprintSnapshot } from "../dealPackages";

describe("deal package blueprint mapping snapshots", () => {
	it("copies mapping overrides into the immutable deal package snapshot", () => {
		const snapshot = toDealPackageBlueprintSnapshot({
			_id: "blueprint_test",
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
			templateId: "template_test",
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
```

- [ ] **Step 2: Run the snapshot test and confirm it fails**

Run:

```bash
bun run test convex/documents/__tests__/mortgageBlueprintMappings.test.ts
```

Expected: FAIL because the helper is missing or the snapshot omits overrides.

- [ ] **Step 3: Preserve overrides when snapshotting blueprints**

In `convex/documents/dealPackages.ts`, locate the code that maps active `mortgageDocumentBlueprints` into `blueprintSnapshots`. Extract it into:

```ts
export function toDealPackageBlueprintSnapshot(
	blueprint: Pick<
		Doc<"mortgageDocumentBlueprints">,
		| "_id"
		| "assetId"
		| "category"
		| "class"
		| "description"
		| "displayName"
		| "displayOrder"
		| "mappingOverrides"
		| "packageKey"
		| "packageLabel"
		| "templateId"
		| "templateVersion"
	>
): DealPackageBlueprintSnapshot {
	return {
		assetId: blueprint.assetId,
		sourceBlueprintId: blueprint._id,
		sourceBlueprintSnapshot: {
			category: blueprint.category,
			class: blueprint.class,
			description: blueprint.description,
			displayName: blueprint.displayName,
			displayOrder: blueprint.displayOrder,
			mappingOverrides: blueprint.mappingOverrides,
			packageKey: blueprint.packageKey,
			packageLabel: blueprint.packageLabel,
			templateId: blueprint.templateId,
			templateVersion: blueprint.templateVersion,
		},
	};
}
```

Replace the inline snapshot builder with this helper.

- [ ] **Step 4: Resolve effective mappings during generation**

In `convex/documents/dealPackages.ts`, where templated package work items call document generation, convert the runtime variable bag into template keys using `sourceBlueprintSnapshot.mappingOverrides`.

Add a helper near generation helpers:

```ts
function applyVariableMappingOverrides(args: {
	sourceBlueprintSnapshot: DealDocumentSourceBlueprintSnapshot;
	variableBag: Record<string, string>;
}) {
	const overrides = new Map(
		(args.sourceBlueprintSnapshot.mappingOverrides?.variables ?? []).map((row) => [
			row.templateVariableKey,
			row.dealVariableKey,
		])
	);
	const mappedVariables: Record<string, string> = {};
	for (const [templateVariableKey, dealVariableKey] of overrides) {
		const value = args.variableBag[dealVariableKey];
		if (typeof value === "string") {
			mappedVariables[templateVariableKey] = value;
		}
	}
	return {
		...args.variableBag,
		...mappedVariables,
	};
}
```

Use this helper immediately before calling the document generation action so default canonical keys still work and override template keys receive mapped values.

- [ ] **Step 5: Resolve signatory overrides during generation**

Add a helper near signatory participant resolution:

```ts
function applySignatoryMappingOverrides(args: {
	sourceBlueprintSnapshot: DealDocumentSourceBlueprintSnapshot;
	signatoryMapping: Array<{ platformRole: string; name: string; email: string }>;
}) {
	const participantsByRole = new Map(
		args.signatoryMapping.map((participant) => [
			participant.platformRole,
			participant,
		])
	);
	const overrides = args.sourceBlueprintSnapshot.mappingOverrides?.signatories ?? [];
	const mapped = [...args.signatoryMapping];
	for (const override of overrides) {
		const participant = participantsByRole.get(override.dealParticipantRole);
		if (participant) {
			mapped.push({
				...participant,
				platformRole: override.templatePlatformRole,
			});
		}
	}
	return mapped;
}
```

Use this helper before passing `signatoryMapping` into document generation. Keep the original participant rows so canonical template roles continue to resolve.

- [ ] **Step 6: Run package tests**

Run:

```bash
bun run test convex/documents/__tests__/mortgageBlueprintMappings.test.ts
bun run test convex/checkout/__tests__/dealHandoff.test.ts convex/deals/__tests__/envelopes.test.ts
```

Expected: PASS or unrelated existing failures recorded with exact failure messages.

## Task 4: Files Tab Entry Point

**Files:**
- Modify: `src/components/admin/shell/RecordAttachmentsPanel.tsx`
- Modify: `src/components/admin/shell/entity-view-adapters.tsx`
- Create: `src/components/admin/mortgages/MortgageFilesDocumentAttachButton.tsx`
- Test: `src/test/admin/mortgage-document-attach-composer.test.tsx`

- [ ] **Step 1: Write failing UI test for the Files-tab button**

Create `src/test/admin/mortgage-document-attach-composer.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MortgageFilesDocumentAttachButton } from "#/components/admin/mortgages/MortgageFilesDocumentAttachButton";

vi.mock("convex/react", () => ({
	useAction: vi.fn(),
	useMutation: vi.fn(),
	useQuery: vi.fn(),
}));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("MortgageFilesDocumentAttachButton", () => {
	it("opens the row-based document attach composer", async () => {
		render(<MortgageFilesDocumentAttachButton mortgageId="mortgage_test" />);

		await userEvent.click(screen.getByRole("button", { name: /attach document/i }));

		expect(screen.getByRole("dialog")).toBeTruthy();
		expect(screen.getByText("Document type")).toBeTruthy();
		expect(screen.getByLabelText("Public static PDF/doc")).toBeTruthy();
		expect(screen.getByLabelText("Private templated read-only")).toBeTruthy();
		expect(screen.getByLabelText("Private signable template")).toBeTruthy();
	});
});
```

- [ ] **Step 2: Run the UI test and confirm it fails**

Run:

```bash
bun run test src/test/admin/mortgage-document-attach-composer.test.tsx
```

Expected: FAIL because `MortgageFilesDocumentAttachButton` does not exist.

- [ ] **Step 3: Add an extension point to RecordAttachmentsPanel**

In `src/components/admin/shell/RecordAttachmentsPanel.tsx`, update props:

```tsx
interface RecordAttachmentsPanelProps {
	readonly headerAction?: React.ReactNode;
	readonly objectDefId: Id<"objectDefs">;
	readonly recordId: string;
	readonly recordKind: "record" | "native";
}
```

Import `type ReactNode` if needed:

```tsx
import type { ReactNode } from "react";
```

Render the action beside the upload button:

```tsx
				<div className="flex flex-wrap items-center gap-2">
					{headerAction}
					<input
						className="hidden"
						multiple
						onChange={(event) => handleFilesSelected(event.target.files)}
						ref={fileInputRef}
						type="file"
					/>
```

- [ ] **Step 4: Create the Files-tab button**

Create `src/components/admin/mortgages/MortgageFilesDocumentAttachButton.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "#/components/ui/button";
import { MortgageDocumentAttachComposer } from "./MortgageDocumentAttachComposer";

interface MortgageFilesDocumentAttachButtonProps {
	readonly mortgageId: string;
}

export function MortgageFilesDocumentAttachButton({
	mortgageId,
}: MortgageFilesDocumentAttachButtonProps) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<Button onClick={() => setOpen(true)} size="sm" type="button">
				Attach document
			</Button>
			<MortgageDocumentAttachComposer
				mortgageId={mortgageId}
				onOpenChange={setOpen}
				open={open}
			/>
		</>
	);
}
```

- [ ] **Step 5: Add a temporary composer shell**

Create `src/components/admin/mortgages/MortgageDocumentAttachComposer.tsx`:

```tsx
"use client";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Label } from "#/components/ui/label";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";

interface MortgageDocumentAttachComposerProps {
	readonly mortgageId: string;
	readonly onOpenChange: (open: boolean) => void;
	readonly open: boolean;
}

export function MortgageDocumentAttachComposer({
	onOpenChange,
	open,
}: MortgageDocumentAttachComposerProps) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-w-3xl">
				<DialogHeader>
					<DialogTitle>Attach mortgage document</DialogTitle>
					<DialogDescription>
						Create a future-only mortgage document blueprint.
					</DialogDescription>
				</DialogHeader>
				<section className="space-y-3">
					<h3 className="font-medium text-sm">Document type</h3>
					<RadioGroup defaultValue="public_static">
						<div className="flex items-start gap-3 rounded-lg border p-3">
							<RadioGroupItem id="public-static" value="public_static" />
							<Label htmlFor="public-static">Public static PDF/doc</Label>
						</div>
						<div className="flex items-start gap-3 rounded-lg border p-3">
							<RadioGroupItem
								id="private-templated"
								value="private_templated_non_signable"
							/>
							<Label htmlFor="private-templated">
								Private templated read-only
							</Label>
						</div>
						<div className="flex items-start gap-3 rounded-lg border p-3">
							<RadioGroupItem
								id="private-signable"
								value="private_templated_signable"
							/>
							<Label htmlFor="private-signable">Private signable template</Label>
						</div>
					</RadioGroup>
				</section>
			</DialogContent>
		</Dialog>
	);
}
```

- [ ] **Step 6: Wire mortgages Files tab adapter**

In `src/components/admin/shell/entity-view-adapters.tsx`, import:

```tsx
import { MortgageFilesDocumentAttachButton } from "#/components/admin/mortgages/MortgageFilesDocumentAttachButton";
```

Add or extend the `mortgages` dedicated adapter:

```tsx
	mortgages: {
		renderDetailsTab: ({ fields, objectDefs, onNavigateRelation, record }) => (
			<MortgagesDedicatedDetails
				fields={fields}
				objectDefs={objectDefs}
				onNavigateRelation={onNavigateRelation}
				record={record}
			/>
		),
		renderFilesTab: ({ objectDef, record, reference }) => {
			if (!(objectDef && record)) {
				return null;
			}
			return (
				<RecordAttachmentsPanel
					headerAction={
						<MortgageFilesDocumentAttachButton mortgageId={reference.recordId} />
					}
					objectDefId={objectDef._id}
					recordId={reference.recordId}
					recordKind={record._kind}
				/>
			);
		},
	},
```

- [ ] **Step 7: Run the UI test**

Run:

```bash
bun run test src/test/admin/mortgage-document-attach-composer.test.tsx
```

Expected: PASS.

## Task 5: Composer Source And Mapping Flow

**Files:**
- Modify: `src/components/admin/mortgages/MortgageDocumentAttachComposer.tsx`
- Create: `src/components/admin/mortgages/MortgageDocumentMappingEditor.tsx`
- Test: `src/test/admin/mortgage-document-attach-composer.test.tsx`

- [ ] **Step 1: Add failing tests for no-card row flow and reset behavior**

Extend `src/test/admin/mortgage-document-attach-composer.test.tsx`:

```tsx
import { useQuery } from "convex/react";

const useQueryMock = useQuery as unknown as ReturnType<typeof vi.fn>;

it("renders mapping rows with reset-to-default controls for templates", async () => {
	useQueryMock.mockReturnValue({
		effectiveMappings: {
			signatories: [
				{
					dealParticipantRole: "borrower_primary",
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
		templateName: "Funding Notice",
		templateVersion: 1,
		validationSummary: {
			containsSignableFields: false,
			requiredPlatformRoles: ["borrower_signer"],
			requiredVariableKeys: ["principal_amount"],
			unsupportedPlatformRoles: [],
			unsupportedVariableKeys: [],
		},
	});

	render(<MortgageFilesDocumentAttachButton mortgageId="mortgage_test" />);
	await userEvent.click(screen.getByRole("button", { name: /attach document/i }));
	await userEvent.click(screen.getByLabelText("Private templated read-only"));

	expect(screen.getByText("principal_amount")).toBeTruthy();
	expect(screen.getByRole("button", { name: /reset principal_amount/i })).toBeTruthy();
	expect(document.querySelector(".card")).toBeNull();
});
```

- [ ] **Step 2: Run the UI test and confirm it fails**

Run:

```bash
bun run test src/test/admin/mortgage-document-attach-composer.test.tsx
```

Expected: FAIL because mapping rows are not rendered.

- [ ] **Step 3: Create the mapping editor**

Create `src/components/admin/mortgages/MortgageDocumentMappingEditor.tsx`:

```tsx
"use client";

import { Button } from "#/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";

export interface MortgageDocumentMappingOverrides {
	signatories: Array<{
		dealParticipantRole: string;
		templatePlatformRole: string;
	}>;
	variables: Array<{
		dealVariableKey: string;
		templateVariableKey: string;
	}>;
}

interface MortgageDocumentMappingEditorProps {
	readonly allowedPlatformRoles: readonly string[];
	readonly allowedVariableKeys: readonly string[];
	readonly mappingOverrides: MortgageDocumentMappingOverrides;
	readonly onChange: (overrides: MortgageDocumentMappingOverrides) => void;
	readonly requiredPlatformRoles: readonly string[];
	readonly requiredVariableKeys: readonly string[];
}

export function MortgageDocumentMappingEditor({
	allowedPlatformRoles,
	allowedVariableKeys,
	mappingOverrides,
	onChange,
	requiredPlatformRoles,
	requiredVariableKeys,
}: MortgageDocumentMappingEditorProps) {
	function setVariableOverride(templateVariableKey: string, dealVariableKey: string) {
		onChange({
			...mappingOverrides,
			variables: [
				...mappingOverrides.variables.filter(
					(row) => row.templateVariableKey !== templateVariableKey
				),
				{ dealVariableKey, templateVariableKey },
			],
		});
	}

	function resetVariable(templateVariableKey: string) {
		onChange({
			...mappingOverrides,
			variables: mappingOverrides.variables.filter(
				(row) => row.templateVariableKey !== templateVariableKey
			),
		});
	}

	function setSignatoryOverride(templatePlatformRole: string, dealParticipantRole: string) {
		onChange({
			...mappingOverrides,
			signatories: [
				...mappingOverrides.signatories.filter(
					(row) => row.templatePlatformRole !== templatePlatformRole
				),
				{ dealParticipantRole, templatePlatformRole },
			],
		});
	}

	function resetSignatory(templatePlatformRole: string) {
		onChange({
			...mappingOverrides,
			signatories: mappingOverrides.signatories.filter(
				(row) => row.templatePlatformRole !== templatePlatformRole
			),
		});
	}

	return (
		<div className="space-y-5">
			<MappingTable
				allowedValues={allowedVariableKeys}
				label="Variable mappings"
				onReset={resetVariable}
				onSet={setVariableOverride}
				rows={requiredVariableKeys}
			/>
			<MappingTable
				allowedValues={allowedPlatformRoles}
				label="Signatory mappings"
				onReset={resetSignatory}
				onSet={setSignatoryOverride}
				rows={requiredPlatformRoles}
			/>
		</div>
	);
}

function MappingTable({
	allowedValues,
	label,
	onReset,
	onSet,
	rows,
}: {
	readonly allowedValues: readonly string[];
	readonly label: string;
	readonly onReset: (key: string) => void;
	readonly onSet: (key: string, value: string) => void;
	readonly rows: readonly string[];
}) {
	return (
		<section className="space-y-2">
			<h3 className="font-medium text-sm">{label}</h3>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Template placeholder</TableHead>
						<TableHead>Mapping</TableHead>
						<TableHead className="w-32">Action</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((row) => (
						<TableRow key={row}>
							<TableCell className="font-mono text-xs">{row}</TableCell>
							<TableCell>
								<Select
									defaultValue={allowedValues.includes(row) ? row : undefined}
									onValueChange={(value) => onSet(row, value)}
								>
									<SelectTrigger aria-label={`Mapping for ${row}`}>
										<SelectValue placeholder="Choose mapping" />
									</SelectTrigger>
									<SelectContent>
										{allowedValues.map((value) => (
											<SelectItem key={value} value={value}>
												{value}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</TableCell>
							<TableCell>
								<Button
									aria-label={`Reset ${row}`}
									onClick={() => onReset(row)}
									size="sm"
									type="button"
									variant="ghost"
								>
									Reset
								</Button>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</section>
	);
}
```

- [ ] **Step 4: Expand the composer state machine**

In `MortgageDocumentAttachComposer.tsx`, replace the shell with step state:

```tsx
type ComposerStep = "type" | "source" | "mappings" | "review";
type ComposerClass =
	| "public_static"
	| "private_templated_non_signable"
	| "private_templated_signable";

const [step, setStep] = useState<ComposerStep>("type");
const [documentClass, setDocumentClass] = useState<ComposerClass>("public_static");
const [selectedTemplateId, setSelectedTemplateId] = useState("");
const [mappingOverrides, setMappingOverrides] =
	useState<MortgageDocumentMappingOverrides>({
		signatories: [],
		variables: [],
	});
```

Use `api.documents.mortgageBlueprints.listAttachableTemplates` for template choices and `api.documents.mortgageBlueprints.previewTemplateMappings` when `selectedTemplateId` is set for templated classes.

- [ ] **Step 5: Add static upload submit**

Reuse `uploadDocumentAsset` as in `DocumentDraftComposer.tsx`. For `public_static`, call:

```tsx
await createStaticBlueprint({
	assetId: createdAsset.assetId,
	class: "public_static",
	description: description.trim() || undefined,
	displayName: resolvedName,
	mortgageId: mortgageId as Id<"mortgages">,
});
```

- [ ] **Step 6: Add template submit**

For templated classes, call:

```tsx
await attachTemplateVersion({
	class: documentClass,
	description: description.trim() || undefined,
	displayName: displayName.trim() || undefined,
	mappingOverrides,
	mortgageId: mortgageId as Id<"mortgages">,
	templateId: selectedTemplateId as Id<"documentTemplates">,
});
```

- [ ] **Step 7: Run component tests**

Run:

```bash
bun run test src/test/admin/mortgage-document-attach-composer.test.tsx
```

Expected: PASS.

## Task 6: E2E Coverage For All Attachment Classes

**Files:**
- Create: `e2e/admin/mortgage-document-attachments.spec.ts`
- Reuse: `e2e/helpers/origination.ts`
- Reuse: `e2e/helpers/document-engine.ts`

- [ ] **Step 1: Write the Playwright spec**

Create `e2e/admin/mortgage-document-attachments.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { createPublishedTemplate } from "../helpers/document-engine";
import { createCommittedMortgage } from "../helpers/origination";

test.describe("admin mortgage document attachments", () => {
	test("attaches public static, interpolable, and signable mortgage documents from Files", async ({
		page,
	}) => {
		const mortgage = await createCommittedMortgage(page);
		const interpolableTemplate = await createPublishedTemplate(page, {
			fields: [{ type: "interpolable", variableKey: "mortgage_principal" }],
			name: "E2E Interpolable Notice",
			signatories: [],
		});
		const signableTemplate = await createPublishedTemplate(page, {
			fields: [
				{ type: "interpolable", variableKey: "mortgage_principal" },
				{
					signatoryPlatformRole: "borrower_primary",
					type: "signable",
				},
			],
			name: "E2E Signable Notice",
			signatories: [{ platformRole: "borrower_primary", role: "signatory" }],
		});

		await page.goto(`/admin/mortgages/${mortgage.mortgageId}`);
		await page.getByRole("tab", { name: "Files" }).click();

		await page.getByRole("button", { name: "Attach document" }).click();
		await page.getByLabel("Public static PDF/doc").click();
		await page.getByLabel("Display name").fill("E2E Public Static");
		await page.getByLabel("PDF upload").setInputFiles("e2e/fixtures/sample.pdf");
		await page.getByRole("button", { name: "Review & attach" }).click();
		await page.getByRole("button", { name: "Attach future-only document" }).click();

		await page.getByRole("button", { name: "Attach document" }).click();
		await page.getByLabel("Private templated read-only").click();
		await page.getByLabel("Template").click();
		await page.getByRole("option", { name: interpolableTemplate.name }).click();
		await expect(page.getByText("mortgage_principal")).toBeVisible();
		await page.getByRole("button", { name: "Attach future-only document" }).click();

		await page.getByRole("button", { name: "Attach document" }).click();
		await page.getByLabel("Private signable template").click();
		await page.getByLabel("Template").click();
		await page.getByRole("option", { name: signableTemplate.name }).click();
		await expect(page.getByText("borrower_primary")).toBeVisible();
		await page.getByRole("button", { name: "Attach future-only document" }).click();

		await page.getByRole("tab", { name: "Details" }).click();
		await expect(page.getByText("E2E Public Static")).toBeVisible();
		await expect(page.getByText(interpolableTemplate.name)).toBeVisible();
		await expect(page.getByText(signableTemplate.name)).toBeVisible();
		await expect(page.getByText(/future deal packages only/i)).toBeVisible();
	});
});
```

- [ ] **Step 2: Add or adapt helpers**

If the helper signatures differ, update `e2e/helpers/document-engine.ts` and `e2e/helpers/origination.ts` with wrapper functions that return:

```ts
export interface E2ePublishedTemplate {
	name: string;
	templateId: string;
}

export interface E2eCommittedMortgage {
	mortgageId: string;
}
```

The wrappers must seed or drive existing UI flows rather than creating a second product path.

- [ ] **Step 3: Run the E2E spec**

Run:

```bash
bun run test:e2e e2e/admin/mortgage-document-attachments.spec.ts
```

Expected: PASS. If fixture/auth setup fails, record the exact failure and run the nearest existing admin/origination E2E to distinguish fixture breakage from feature failure.

## Task 7: Quality Gates And Branch Recording

**Files:**
- Verify all touched files

- [ ] **Step 1: Run formatting/lint autofix first**

Run:

```bash
bun check
```

Expected: PASS or only pre-existing unrelated diagnostics. Do not manually chase formatting before this command.

- [ ] **Step 2: Run typecheck**

Run:

```bash
bun typecheck
```

Expected: PASS.

- [ ] **Step 3: Run Convex codegen**

Run:

```bash
bunx convex codegen
```

Expected: PASS with generated API/types in sync.

- [ ] **Step 4: Run targeted tests**

Run:

```bash
bun run test convex/documents/__tests__/mortgageBlueprintMappings.test.ts src/test/admin/mortgage-document-attach-composer.test.tsx
bun run test:e2e e2e/admin/mortgage-document-attachments.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Run GitNexus change detection**

Run:

```bash
npx gitnexus detect-changes
```

Expected: affected symbols and flows are limited to mortgage document blueprints, deal package document materialization, and admin mortgage Files-tab UI.

- [ ] **Step 6: Record the change with Graphite**

If this is the first tracked change on a new branch:

```bash
gt create -am "feat: attach mortgage documents after origination"
```

If the branch is already tracked:

```bash
gt modify -am "feat: attach mortgage documents after origination"
```

Expected: Graphite records the branch update without skipped hooks.

## Self-Review

- Spec coverage: The plan covers the Files-tab button, guided drawer/dialog, no-card UI, public static uploads, private interpolable templates, private signable templates, mapping overrides, future-only package behavior, validation, component tests, and E2E coverage for all three attachment classes.
- Placeholder scan: No implementation step is left as a blank follow-up; every task includes exact files, commands, and the intended code shape.
- Type consistency: The plan uses `mappingOverrides` consistently across contracts, schema, blueprint mutations, deal package snapshots, and frontend payloads.
