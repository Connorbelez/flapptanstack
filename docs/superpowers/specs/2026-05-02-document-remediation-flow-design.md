# Document Remediation Flow Design

## Summary

Admins need a focused way to remediate individual deal package documents that failed during generation or provider envelope creation. Failures can come from missing variable mappings, missing signatory mappings, templates that assign a signer without signature-capable fields, Documenso provider errors, or generic generation errors.

The remediation flow should not recreate the document engine. Deal detail becomes the operational remediation center: it diagnoses the failed package member, links admins to the right authoring surface, and offers scoped row-level actions. The document engine and mortgage blueprint flows remain the source of truth for authoring and validation.

## Goals

- Remediate one failed deal document package member without replaying the whole package by default.
- Preserve immutable failure evidence by archiving failed rows and creating replacement rows instead of patching failed rows in place.
- Let admins fix the current deal and, separately, decide whether the underlying mortgage blueprint should change for future deals.
- Keep the deal detail UI compact and action-oriented, not a second template designer.
- Require an explicit waiver reason when a failed document is removed from the current deal.

## Non-Goals

- Build a full cross-deal remediation queue in v1.
- Embed the document template designer inside the deal detail sheet.
- Add inline variable or signatory mapping editors to deal detail in v1.
- Delete historical failed/generated rows from Convex or remote Documenso.

## Current Context

- `dealDocumentInstances` already stores immutable package members with status, `lastError`, source blueprint id, and frozen `sourceBlueprintSnapshot`.
- Package generation and retry behavior already archives retry rows and creates new rows.
- Package status is derived from active, non-archived rows.
- Mortgage blueprints already support replace/archive behavior, and the admin mortgage document UI can link to the template designer.
- Existing deal detail surfaces already display document status, provider envelope status, recipient state, and errors.

## Architecture

Add a row-level remediation layer on top of the existing immutable deal package model.

The read model derives a `remediation` object for each failed or blocked active deal document instance from:

- instance `status`
- instance `lastError`
- signing/envelope status and error
- frozen `sourceBlueprintSnapshot`
- source blueprint availability and active/archived state

The remediation object drives the UI diagnosis, recommended next action, available links, and allowed actions. It is not a long-lived diagnosis record in v1.

Row-level backend actions:

- `waiveDealDocumentInstance`: archive/remove the failed instance from the current deal only, requiring a short reason and recording it as an intentional deal-level waiver.
- `retryDealDocumentInstance`: retry only this failed instance using its frozen snapshot.
- `refreshDealDocumentInstanceSnapshot`: archive the failed instance and create a replacement from the latest active source blueprint/template snapshot.
- `archiveSourceBlueprintForFutureDeals`: archive the source mortgage blueprint so future deals stop using it.

The existing package retry remains available as `Retry all failed documents` for batch recovery.

## Remediation Categories

The read model should classify failures into these user-facing categories:

- `missing_variable_mapping`: missing interpolation values or unresolved custom variables.
- `missing_signatory_mapping`: required template signatory roles cannot resolve to deal participants.
- `signer_missing_signature_fields`: a signer recipient exists but has no signature-capable field.
- `provider_create_failed`: Documenso envelope creation/distribution failed after local generation.
- `recipient_resolution_failed`: recipient routing could not be resolved before provider creation.
- `generation_failed`: generic PDF/template generation failure.

Each category should include:

- diagnosis label
- concise explanation
- recommended next step
- relevant action availability
- relevant authoring links

## Data Model

Do not store persistent diagnosis records in v1. Store only operator action evidence.

Use `auditJournal` for remediation events. The journal entry should use `entityType: "deal"` and `entityId: String(dealId)`, with `linkedRecordIds` carrying package, instance, replacement instance, source blueprint, mortgage, and generated document ids as applicable. Do not add a separate remediation event table in v1.

Each remediation audit event should capture:

- deal id
- package id
- failed instance id
- source blueprint id when present
- action type: `waived_for_deal`, `retried_instance`, `refreshed_from_source_snapshot`, `archived_source_blueprint`
- actor
- timestamp
- reason when required
- replacement instance id when archive-and-replace succeeds
- old/new template id/version or blueprint id when relevant
- failure details if a remediation action fails after it starts

Add only minimal cross-reference fields to `dealDocumentInstances` if current schema cannot support the history cleanly:

- `supersededByInstanceId?: Id<"dealDocumentInstances">`
- `remediationReason?: string`
- `remediationAction?: "waived_for_deal" | "refreshed_from_source_snapshot" | "retried_instance"`

Package status continues to be derived from active, non-archived rows. A waived failed row is archived. If all remaining active rows are valid, the package may recover to `ready`.

## Admin UX

Failed or blocking active document rows show a compact `Remediation` area below the error.

The row shows:

- diagnosis label
- affected source, including template name/version and mortgage blueprint/package label when known
- short next-step copy
- authoring links:
  - `Open designer` for template or signature field fixes
  - `Open source mortgage document` or `Replace source blueprint` for blueprint/template snapshot fixes
- row actions:
  - `Retry this document`
  - `Update from latest source snapshot`
  - `Remove from this deal`
  - `Archive source blueprint for future deals`

`Remove from this deal` opens a confirmation dialog with a required short reason. The row is archived as a deal-level waiver and moves to archived documents with the reason visible.

`Archive source blueprint for future deals` opens a separate confirmation. It does not remove or waive the current deal instance.

Archived rows show historical remediation metadata and authoring links when useful, but they do not show active row-level remediation actions.

## Action Behavior

### Remove From This Deal

- Requires `deal:manage`.
- Requires a non-empty reason.
- Archives the failed active instance.
- Records the waiver reason and audit/remediation event.
- Does not mutate the source mortgage blueprint.
- Allows package status to recover if remaining active rows are valid.

### Archive Source Blueprint For Future Deals

- Requires `deal:manage`.
- Requires the source blueprint to still exist and be active.
- Archives only the mortgage blueprint.
- Records a remediation event that links the deal failure to the future-facing blueprint archive.
- Does not remove the current failed deal instance.

### Retry This Document

- Requires `deal:manage`.
- Requires an active failed/blocking instance.
- Uses the failed instance's frozen source snapshot.
- Archives the old failed instance and creates a replacement attempt row.
- Does not adopt later blueprint/template edits.

### Update From Latest Source Snapshot

- Requires `deal:manage`.
- Requires a source blueprint-backed instance.
- Requires the source blueprint to exist and be active.
- Builds a fresh package member from the latest source blueprint/template snapshot.
- Archives the failed row and creates a replacement row.
- Updates only that failed package member.
- Does not retry all package failures.

### Retry All Failed Documents

- Remains a package-level action.
- Replays all active failed/blocking members using existing package retry behavior.
- Should be visually separate from row-level actions.

## Validation And Failure Handling

Before any remediation action mutates state, the backend re-loads and validates:

- deal exists
- package exists for the deal
- instance belongs to the deal and package
- instance is active and remediable
- actor has `deal:manage`
- source blueprint actions only run when the source blueprint exists and is active
- snapshot refresh only runs for blueprint-backed instances
- waiver/removal includes a non-empty reason

If provider creation fails during retry or refresh, the replacement instance records failure using existing package-generation status/error conventions. The old failed row should be archived only once a replacement attempt row exists, so there is always visible evidence of the original failure and the remediation attempt.

## Testing

Backend tests:

- derives remediation recommendations for missing variables, missing signatory mappings, signer-without-signature-field, provider failure, recipient resolution failure, and generic generation failure
- waiver archives only the current deal instance, requires a reason, records evidence, and lets package status recover when remaining rows are valid
- archive source blueprint affects future deals only and does not remove the current failed instance
- retry this document uses the frozen failed snapshot
- update from latest source snapshot archive-and-replaces only that failed member
- batch retry still retries all failed active members
- permission checks block non-admin/non-`deal:manage` users

Frontend tests:

- failed document rows render diagnosis, links, and row-level actions
- archived rows show historical remediation metadata without active remediation buttons
- remove confirmation requires a reason
- successful row actions refresh/re-render the row in the active or archived sections
- package-level retry remains separate from row-level retry

Validation commands:

- `bun check`
- `bun typecheck`
- `bunx convex codegen`
- focused Convex tests for remediation actions/read model
- focused React tests for admin deal detail remediation UI

## Implementation Notes

- Prefer reusing existing package generation helpers rather than duplicating PDF generation, variable resolution, signatory mapping, or Documenso provider code.
- If current helper boundaries make single-instance retry awkward, extract a small shared service around package work items rather than adding special one-off generation paths.
- Authoring links should deep-link to existing document engine/template routes and mortgage blueprint surfaces. If exact route support is missing, add route search params that preselect the relevant template or blueprint.
- Keep the v1 UI row-level. A cross-deal remediation queue can be added later using the same derived remediation read model.
