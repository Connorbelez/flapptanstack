# Chunk Context: chunk-03-uploads-versions

## Goal
- Deliver upload request/finalize, replacement versions, immutable version listing, restore-as-new-current, and scan-result current-version promotion.

## Relevant plan excerpts
- "Every upload creates version `1`; replacing a file creates version `n + 1`."
- "Previous current version stays visible until the new version is clean/released."
- "Restoring an old version creates a new current version instead of rewriting history."
- "Version rows are immutable except scan/release transition fields from ENG-367."

## Implementation notes
- Use Convex `ctx.storage.generateUploadUrl`, `ctx.storage.getUrl`, and `ctx.storage.delete` only behind operation-specific authorization and policy gates.
- Existing `scanMutations.applyScanResult` updates scan fields but does not currently promote a clean replacement to current; this chunk must address that.
- Keep stale scan results harmless when a newer clean/released version is already current.

## Existing code touchpoints
- `convex/fileWorkspace/scanMutations.ts`: `applyScanResult`, `releaseScanError`.
- `convex/fileWorkspace/scanner.ts` and `scanActions.ts`: scanner policy/result flow.
- New expected modules: `convex/fileWorkspace/uploads.ts`, `convex/fileWorkspace/versions.ts`.
- GitNexus impact pending after index completes.

## Validation
- Convex tests for first upload, replacement, pending replacement visibility, scan promotion, stale scan result, version list permissions, and restore-as-new-current.
