# Chunk Context: chunk-03-workspace-docs-remediation

## Goal
- Render the package workspace and wire FairLend-owned edits, document upload/linking, sync-now, and remediation visibility.

## Relevant plan excerpts
- "Render the package workspace with immutable Velocity-owned sections and editable FairLend-owned sections clearly separated."
- "Wire document upload/link controls to the shared PDF upload helper and package document-link mutations."
- "Wire `Sync now` to the backend sync surface from the package workspace."
- "Keep final activation actions out of this slice except for downstream handoff/navigation affordances."

## Implementation notes
- Use `api.velocity.workspaces.getVelocityPackageWorkspace` for the detail DTO.
- Use `api.velocity.workspaces.updateVelocityPackageFairLendFields` for FairLend-owned edits.
- Use `api.velocity.documents.linkVelocityPackageDocument` for PAD/supporting document roles.
- Use `api.documents.assets.generateUploadUrl`, `api.documents.assets.extractPdfMetadata`, `api.documents.assets.create`, and `uploadDocumentAsset` for PDF upload.
- Use `api.velocity.sync.syncVelocityPackageNow` for manual sync.
- Supported editable fields in this slice: bank input, activation remediation `loanType`/`lienPosition`/notes, staff notes, valuation basics, and listing support text fields.
- Render blockers/warnings/exceptions/snapshots from DTOs; do not derive readiness.

## Existing code touchpoints
- `src/components/admin/velocity/VelocityWorkspacePage.tsx`: create.
- `src/components/admin/velocity/VelocityDocumentPanel.tsx`: create.
- `src/lib/documents/uploadDocumentAsset.ts`: consume, do not modify unless required.
- `src/components/admin/origination/CollectionsStep.tsx`: shared upload helper usage pattern.
- GitNexus impact is not required for new component symbols before creation; impact is required if existing helper symbols are modified.

## Validation
- component tests for immutable/editable separation, edit mutation payloads, document upload/link, sync-now, blockers, warnings, exceptions
- `bun check`
- `bun typecheck`
