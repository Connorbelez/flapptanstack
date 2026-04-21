# Execution Status: ENG-302 - Broker portal: add explicit borrower portal attribution on onboarding and borrower records

- Overall status: complete
- Current phase: validation-complete
- Current chunk: chunk-05-validation-audit
- Last updated: 2026-04-20 22:22:14 EDT

## Active focus
- Final closeout complete: deterministic attribution backfill, borrower middleware cutover, targeted tests, and spec audit all passed for the current branch diff.

## Blockers
- none

## Notes
- Initial detached checkout (`0cc509431`) did not contain the portal registry or middleware stack assumed by the issue. Switched this worktree onto `codex/eng-302-explicit-borrower-portal-attribution` from commit `49cb04031` so the implementation matches the linked plan's dependency stack.
- GitNexus index was refreshed after the branch switch. Impact analysis results stayed LOW for `requestRole`, `ensureCanonicalBorrowerForOrigination`, `resolvePortalBorrower`, `resolveUserHomePortalId`, `runPortalRegistryBackfill`, `getPortalRegistryBackfillStatus`, and `backfillUserHomePortalId`.
- The linked plan's file map had path drift versus this branch. Real borrower write-path file is `convex/borrowers/resolveOrProvisionForOrigination.ts`; portal middleware and home-portal helpers already exist in `convex/portals/`.
- Chunk 01 completed successfully: `bunx convex codegen` passed and `bun run test -- src/test/convex/onboarding/onboarding.test.ts src/test/convex/onboarding/onboarding-queries.test.ts src/test/auth/integration/onboarding-auth.test.ts` passed with only the expected GT hashchain kill-switch warnings.
- Chunk 02 completed successfully: `bunx convex codegen` passed and `bun run test -- src/test/convex/admin/origination/commit.test.ts src/test/convex/seed/seedAll.test.ts` passed with only the expected GT hashchain kill-switch warnings.
- Chunk 03 and chunk 04 completed successfully: `bun run test -- convex/portals/__tests__/middleware.test.ts convex/portals/__tests__/registry.test.ts` passed after the deterministic backfill, explicit home-portal cutover, and same-org wrong-portal denial coverage landed.
- Final quality gates completed on the final tree: `bunx convex codegen`, `bun check`, and `bun typecheck` all passed. `bun check` still reports the repo's pre-existing cognitive-complexity warnings outside ENG-302 scope.
- CodeRabbit `--type uncommitted` review returned one artifact-only finding on a hardcoded validation path in `specs/ENG-302/chunks/chunk-05-validation-audit/context.md`; fixed locally. The GitNexus CLI in this environment does not expose the `detect-changes` command referenced by repo docs, so changed-scope sanity was recorded via impact analysis plus `git diff --stat`.
