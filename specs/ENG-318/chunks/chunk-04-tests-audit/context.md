# Chunk Context: chunk-04-tests-audit

## Goal
- Add focused backend coverage, run the repo quality gates, and close out the required spec audit and artifact validation.

## Relevant plan excerpts
- "Add focused tests for import upserts, exact license lookups, brokerage association matching, freshness mapping, mock/provider parity, and manual refresh behavior."
- "Run `bunx convex codegen`, `bun check`, and `bun typecheck`."
- "Before finalizing, invoke `$linear-pr-spec-audit` against the same issue and the current PR or branch diff, then persist the verdict in `specs/ENG-318/audit.md`."

## Implementation notes
- This issue is backend-only, so E2E and Storybook work should be recorded as not applicable unless implementation scope changes.
- The spec audit is a release gate. Do not mark the issue complete while `audit.md` still has unresolved `MISSING` or `CONTRADICTED` items.
- Final artifact validation requires checklist closure, task closure, and a non-placeholder audit verdict.

## Existing code touchpoints
- `src/test/convex/onboarding/fsra-import.test.ts` (new)
- `src/test/convex/onboarding/regulator-provider.test.ts` (new)
- `src/test/convex/onboarding/verification-contracts.test.ts`
- `specs/ENG-318/audit.md`
- `specs/ENG-318/execution-checklist.md`
- `specs/ENG-318/tasks.md`

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- `bun run test -- src/test/convex/onboarding/fsra-import.test.ts src/test/convex/onboarding/regulator-provider.test.ts`
- `python3 /Users/connor/.codex/skills/linear-implement-v2/scripts/validate_execution_artifacts.py ENG-318 --repo-root /Users/connor/.codex/worktrees/d8c0/fairlendapp --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`
