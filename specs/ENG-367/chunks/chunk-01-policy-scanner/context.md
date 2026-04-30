# Chunk Context: chunk-01-policy-scanner

## Goal
- Deliver the pure TypeScript scanner and policy contract consumed by Convex upload/version flows.

## Relevant plan excerpts
- Define `FileScanner.scan(input)` and `FileScanResult`.
- Use built-in validation only; no paid third-party scanning APIs and no host-installed binary dependencies.
- Default allowed file policy: PDF, Microsoft Office/OpenXML, OpenDocument, CSV, TXT/Markdown, common images.
- Archives are disabled by default unless safe inspection is selected.

## Implementation notes
- Use ENG-366 `FileWorkspaceScanPolicy` and `FileWorkspaceStorageLimits` types from `convex/fileWorkspace/types.ts`.
- Existing `normalizeFileWorkspaceName` is already in `validators.ts`; scanner should reuse it instead of duplicating name rules.
- `convex/documents/assets.ts` provides the action pattern for `Blob.arrayBuffer()` and SHA-256.
- Visibility gating helper should return true only for `clean` and `released_by_admin`.

## Existing code touchpoints
- `convex/fileWorkspace/types.ts`: import scan policy and scan state contracts.
- `convex/fileWorkspace/validators.ts`: reuse `normalizeFileWorkspaceName`.
- GitNexus: document upload symbols LOW risk; `AuditTrail` MEDIUM but not edited.

## Validation
- `bun run test -- convex/fileWorkspace`
- `bun check`
