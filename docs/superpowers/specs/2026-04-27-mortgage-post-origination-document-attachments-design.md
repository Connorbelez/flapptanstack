# Mortgage Post-Origination Document Attachments Design

## Purpose

Admins need to attach mortgage-owned documents after origination from `http://admin.localhost:3000/admin/mortgages/[mortgageId]`. The feature should use the existing document engine and mortgage blueprint plumbing instead of creating a second template authoring surface.

The admin entry point is a button under the mortgage **Files** tab. It opens a guided drawer/dialog for attaching:

- public static PDFs/docs
- private templated non-signable documents with interpolable variables
- private templated signable documents with interpolable variables and placeholder signatories

This spec covers the design only. It does not implement the feature.

## Source Context

Relevant repo context reviewed:

- `convex/schema.ts` already defines `mortgageDocumentBlueprints`, `documentAssets`, `documentTemplates`, `generatedDocuments`, `signatureEnvelopes`, `signatureRecipients`, `dealDocumentPackages`, and `dealDocumentInstances`.
- `convex/documents/mortgageBlueprints.ts` already contains core blueprint create, attach, replace, archive, and list behavior.
- `convex/documents/contracts.ts` defines the mortgage document blueprint classes, supported deal variable keys, supported signatory roles, and validation summary contracts.
- `convex/documents/templateValidation.ts` loads pinned template snapshots and validates fields/signatories for mortgage document classes.
- `convex/documents/dealPackages.ts` materializes mortgage blueprints into deal document package instances, builds deal variable bags, and resolves signatory mappings during package creation.
- `src/components/admin/origination/DocumentDraftComposer.tsx` and `DocumentDraftList.tsx` provide a close existing pattern for document attachment UX during origination.
- `src/components/admin/shell/dedicated-detail-panels.tsx` currently displays mortgage document blueprints and offers replace/archive actions on the mortgage detail surface.
- The document engine workspace already exists for template authoring; this feature must consume published templates, not duplicate template building.

## Decisions

- The Files tab gets an `Attach document` button that opens a guided drawer/dialog.
- Do not use card-based UI. Use compact rows, radio groups, selects, tables, and form sections.
- The drawer creates mortgage document blueprint rows; it does not generate documents immediately.
- Template authoring stays in the document engine workspace.
- Static uploads create or reuse `documentAssets`, then create a static mortgage blueprint.
- Templated attachments select a published template version, then create a templated mortgage blueprint.
- Mapping behavior is hybrid: use canonical defaults first, allow admins to override every variable and signatory mapping, and provide reset-to-default per row.
- Blueprint changes are future-only. They affect future listing/deal locks and never mutate existing locked deal packages.
- Existing mortgage Documents summary remains a read/status surface with open, replace, and archive actions.
- E2E coverage must include public static, interpolable non-signable, and signable document attachments.

## User Experience

The Files tab should show existing file/document context and a primary `Attach document` action. The action opens a drawer or dialog with a guided flow:

```text
1. Document type
2. Source
3. Mappings
4. Review & attach
```

The document type step uses row-based choices:

- `Public static PDF/doc`
- `Private templated read-only`
- `Private signable template`

The source step adapts by type:

- Static: upload/select a PDF-backed document asset and provide display metadata.
- Templated read-only: select a published template version compatible with non-signable generated output.
- Signable: select a published signable template version with signatory fields.

The mappings step shows one row per required variable and one row per required signatory role. Each row shows:

- placeholder key or role
- default canonical mapping
- current mapping
- resolved/unresolved state
- override control
- reset-to-default action

The review step summarizes document class, source, pinned template version or asset, mapping overrides, validation status, and an explicit message that the attachment applies only to future deal packages.

## Backend And Data Flow

The composer persists mortgage blueprints, not generated documents. That keeps the lifecycle aligned with existing package materialization:

```text
Admin attaches document
  -> create document asset or select published template
  -> validate class/source/template/mappings
  -> create mortgageDocumentBlueprints row
  -> future listing/deal lock snapshots active blueprints
  -> deal package materialization generates/static-references documents
```

Public static documents:

- upload to Convex storage
- create `documentAssets`
- create `mortgageDocumentBlueprints` with class `public_static` and `assetId`

Private read-only templates:

- select a published template version and pin that version on the blueprint
- validate it has no signable fields for the non-signable class
- store template snapshot metadata and mapping overrides on the blueprint

Private signable templates:

- select a published template version with signable fields/signatory configuration
- validate required platform roles and variable keys
- store template snapshot metadata and mapping overrides on the blueprint

Add an optional mapping override payload to `mortgageDocumentBlueprints`. The payload is scoped to the blueprint, versioned with the pinned template snapshot, and resolved at package materialization time before calling document generation/signature setup.

Suggested payload shape:

```text
mappingOverrides?: {
  variables: Array<{ templateVariableKey: string; dealVariableKey: string }>;
  signatories: Array<{ templatePlatformRole: string; dealParticipantRole: string }>;
}
```

Only explicit overrides are stored. Defaults remain derived from the pinned template snapshot and canonical resolver.

## Mapping Model

Defaults come from existing canonical document engine concepts:

- template variable keys map to supported deal variable keys
- template signatory platform roles map to supported FairLend mortgage/deal participants

Overrides are explicit blueprint-scoped choices. Saving an override should not mutate the source template or document engine configuration.

Mapping resolution should produce a final effective mapping:

```text
effective mapping = explicit blueprint override ?? canonical template/default mapping
```

The UI should allow overriding all mappings, not only unresolved ones. It should make defaults visible and easy to restore. Validation must block save when a required variable or signatory cannot be resolved after overrides are applied.

## Component Design

`MortgageFilesDocumentAttachButton`

- Lives under the mortgage Files tab.
- Receives `mortgageId`.
- Opens the attach composer.

`MortgageDocumentAttachComposer`

- Owns drawer/dialog open state, step state, selected type, selected source, mapping edits, validation display, and submit.
- Reuses the existing upload utility and document attachment patterns where possible.
- Calls dedicated Convex queries/mutations for attachable templates, default mapping preview, validation, and final blueprint creation.

`MortgageDocumentMappingEditor`

- Receives template snapshot metadata, default mappings, current overrides, and validation output.
- Renders editable row/table controls.
- Emits mapping override changes.
- Supports reset-to-default per row.

The existing mortgage Documents panel remains focused on listing active/archived blueprints, validation summary, open PDF, replace, and archive.

## Validation And Errors

Validation should happen in layers:

- Source selection: static classes require document assets; templated classes require published template versions.
- Template selection: class/template compatibility is checked before mapping.
- Mapping review: every variable and signatory role shows default/current mapping and resolved state.
- Confirm: mutations reject stale template versions, archived assets, invalid classes, unresolved required mappings, and missing admin permission.
- After save: Files tab and mortgage Documents summary refresh.

Error messages should be specific and operational:

- `Borrower lawyer signatory is unresolved.`
- `Template requires mortgage.principal but no mapping exists.`
- `This template contains signable fields and cannot be attached as a read-only template.`

## Testing

Convex tests should cover:

- public static asset attach
- private templated non-signable attach
- private signable attach
- mapping override validation
- reset-to-default/effective mapping behavior
- incompatible signable/non-signable templates
- stale template version rejection
- archived asset rejection
- permission rejection
- future-only semantics

React component tests should cover:

- opening the composer from the Files tab button
- row-based document type selection
- static upload/source selection
- template source selection
- variable mapping override edits
- signatory mapping override edits
- reset-to-default behavior
- validation message rendering
- successful submit payload

Playwright E2E should cover all attachment classes:

- attach a public static PDF from the mortgage Files tab
- attach a private interpolable non-signable template and confirm variable mappings
- attach a private signable template and confirm variable plus signatory mappings
- verify each attachment appears in the mortgage document summary
- verify the UI states attachments apply to future deal packages only

## Non-Goals

- No new template authoring workspace.
- No document engine field positioning UI.
- No regeneration or mutation of existing locked deal packages.
- No card-based UI.
- No full dedicated mortgage document subpage in this version.
