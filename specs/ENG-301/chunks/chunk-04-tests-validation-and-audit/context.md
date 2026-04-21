# Chunk Context: chunk-04-tests-validation-and-audit

## Goal
- Close the issue with backend and frontend tests, repo quality gates, GitNexus scope reconciliation, and the required spec audit.

## Relevant plan excerpts
- "Portal query and cache boundaries prevent stale listing data from leaking across hosts on the same pathname."
- "Run repo validation commands and confirm the downstream landing-page handoff contract is now executable without rediscovery."
- "Invoke `$linear-pr-spec-audit` against the same issue and the current review target."

## Implementation notes
- The declared repo quality gates are `bunx convex codegen`, `bun check`, and `bun typecheck`.
- The most relevant existing test suites are `convex/listings/__tests__/queries.test.ts`, `src/test/lender/listing-detail-page.test.tsx`, `src/test/routes/portal-context.test.tsx`, and `src/test/routes/portal-query-cache-scope.test.ts`.
- `bun run test:e2e` should be attempted if the updated route surface is runnable in this worktree; if environment blockers prevent that, the blocker must be recorded explicitly.
- Final scope reconciliation should use GitNexus first and shell diff inspection as a fallback only if GitNexus fails or returns an obviously incomplete result.

## Existing code touchpoints
- `convex/listings/__tests__/queries.test.ts`
- `src/test/lender/listing-detail-page.test.tsx`
- `src/test/routes/portal-listings.test.tsx`
- `src/test/routes/portal-query-cache-scope.test.ts`
- `specs/ENG-301/audit.md`

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- targeted portal and listing test command
- `bun run test:e2e` when feasible
- `$linear-pr-spec-audit`
