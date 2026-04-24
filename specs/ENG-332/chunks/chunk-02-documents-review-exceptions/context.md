# Chunk Context: chunk-02-documents-review-exceptions

## Goal
- Deliver package document linking, final-review confirmation, exception resolution, and exports.

## Relevant plan excerpts
- "Package document links must reference existing `documentAssets` rows and preserve role/supersession history rather than mutating asset records."
- "Final-review confirmation must persist the reviewed snapshot hash and invalidate immediately when the current normalized hash changes."
- "Expose exception resolution and package audit events for staff-owned edits, document linking, readiness recomputation, and review confirmation."

## Implementation notes
- `documentAssets` already stores PDFs only and includes `fileHash`, `originalFilename`, `mimeType`, `uploadedAt`, and `uploadedByUserId`.
- `velocityPackageDocumentLinks` has workspace, asset, role, linked user/time, and optional `supersededAt`.
- Final review should reject stale snapshot ids or mismatched hashes before mutating the workspace.
- Exception resolution should leave readiness derived; resolving an operational exception does not hide still-active blockers.

## Existing code touchpoints
- `convex/documents/assets.ts`: existing PDF asset lifecycle.
- `convex/velocity/audit.ts`: package audit append helper.
- `convex/velocity/index.ts`: stable Velocity namespace exports.
- `convex/test/moduleMaps.ts`: convex-test module map for new Convex function files.

## Validation
- Targeted Velocity Convex tests.
- `bunx convex codegen`, `bun check`, `bun typecheck`.
