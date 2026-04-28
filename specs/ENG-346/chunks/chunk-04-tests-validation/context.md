# Chunk Context: chunk-04-tests-validation

## Goal
- Close coverage and quality gates, run the required spec audit, and verify final artifact state.

## Relevant plan excerpts
- Required commands: `bunx convex codegen`, `bun check`, `bun typecheck`, targeted tests, `bun run test`, `bun run test:e2e`, `bun run review`.
- "Before finalizing, invoke `$linear-pr-spec-audit` against the same issue and the current PR or branch diff, then persist the verdict in `specs/<issue-key>/audit.md`."

## Implementation notes
- Run `bun check` before manual lint fixes, per repo instructions.
- E2E may require local app/test auth setup; if blocked, record the exact command output and blocker.
- Run GitNexus change detection before final response.

## Existing code touchpoints
- `src/test/admin/`
- `src/test/convex/`
- `e2e/deal-closing/`
- `specs/ENG-346/audit.md`

## Validation
- `python3 scripts/validate_execution_artifacts.py ENG-346 --repo-root "/Users/connor/.codex/worktrees/bd5d/nt1n" --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`
- GitNexus detect changes or CLI equivalent.
