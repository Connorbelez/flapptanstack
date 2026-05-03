# Chunk Context: chunk-01-fixtures

## Goal
- Provide deterministic backend and Playwright helpers for the File Workspace E2E suites.

## Relevant plan excerpts
- Create `e2e/helpers/file-workspace.ts`.
- Seed admin, broker manager, editor, viewer, unrelated user, active/suspended boxes, nested tree, clean/pending/rejected/released/deleted files, expired/revoked links.
- Keep shared E2E helpers additive or wrapped.

## Implementation notes
- Add a new `convex/test/fileWorkspaceE2e.ts` helper API instead of changing shared File Workspace production contracts.
- Gate test-only Convex helpers with an explicit env var, matching existing `convex/test/*E2e.ts` patterns.
- Use `ConvexHttpClient` and `/e2e/session` access token patterns from `e2e/helpers/origination.ts`.

## Existing code touchpoints
- `e2e/helpers/auth-storage.ts:createAuthStorageState` GitNexus risk MEDIUM; do not edit.
- `e2e/helpers/origination.ts` has the Convex client and upload helper pattern.
- `convex/fileWorkspace/testUtils.ts` has backend fixture concepts but should remain unchanged unless a lower-level test requires it.

## Validation
- `bunx convex codegen`
- `bun run test -- convex/fileWorkspace`
- `bun run test:e2e -- e2e/file-workspace` after specs exist
