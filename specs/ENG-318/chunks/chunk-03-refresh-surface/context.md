# Chunk Context: chunk-03-refresh-surface

## Goal
- Add one shared refresh orchestration path plus the operational entrypoints that call it.

## Relevant plan excerpts
- "Add a single internal refresh orchestration action that both daily cron execution and manual admin refresh call, following the existing start-run / finish-run operational pattern."
- "Expose a public admin action for manual refresh behind the explicit onboarding-management boundary instead of embedding refresh logic in routes or UI-only code."
- "Add a repeatable import or refresh orchestration path, a daily cron trigger, and an admin-triggerable manual refresh action."

## Implementation notes
- Keep cron and manual refresh on the same internal seam; do not duplicate refresh logic.
- Use `fluent-convex` exports with explicit visibility and the existing auth middleware for `onboarding:manage`.
- Persist run state in `fsraImportRuns` so refresh behavior stays operationally understandable and testable.

## Existing code touchpoints
- `convex/onboarding/verification/actions.ts` (new)
- `convex/onboarding/verification/fsraImport.ts`
- `convex/crons.ts`
- `convex/fluent.ts`
- `convex/auth/permissionCatalog.ts`
- `convex/admin/origination/collections.ts`

## Validation
- `bun run test -- src/test/convex/onboarding/fsra-import.test.ts`
- `bunx convex codegen`
