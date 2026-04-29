# Chunk Context: chunk-03-tests-validation-and-audit

## Goal
- Prove the snapshot and export seams behave deterministically, then close the issue through repo gates and a spec-compliance audit.
- Keep execution artifacts, tests, and audit state aligned so ENG-310 can be resumed or reviewed without reopening the full planning workspace.

## Relevant plan excerpts
- "Add tests for reruns, year-end boundaries, current-period fallback, and stable export output."
- "Required commands: `bunx convex codegen`, `bun check`, `bun typecheck`, `bun run test -- convex/portfolio/__tests__/snapshots.test.ts convex/portfolio/__tests__/export.test.ts`."
- "The CSV export contract is server-generated and stable enough for `ENG-313` to consume directly."

## Implementation notes
- Focused backend tests are mandatory because the downstream UI slice trusts ENG-310 contracts directly for completeness metadata and CSV payload shape.
- This is a backend producer slice, so E2E and Storybook work should be recorded as explicitly not applicable unless the scope expands into route or component ownership.
- Final closeout must include `$linear-pr-spec-audit`, `scripts/validate_execution_artifacts.py --stage final`, and a best-effort GitNexus scope review against the actual changed symbols.

## Existing code touchpoints
- `convex/portfolio/__tests__/queries.test.ts`
- `convex/portfolio/__tests__/snapshots.test.ts`
- `convex/portfolio/__tests__/export.test.ts`
- `specs/ENG-310/audit.md`
- `specs/ENG-310/execution-checklist.md`

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- `bun run test -- convex/portfolio/__tests__/snapshots.test.ts convex/portfolio/__tests__/export.test.ts convex/portfolio/__tests__/queries.test.ts`
- `python3 /Users/connor/.codex/skills/linear-implement-v2/scripts/validate_execution_artifacts.py ENG-310 --repo-root "/Users/connor/.codex/worktrees/a335/fairlendapp" --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`
