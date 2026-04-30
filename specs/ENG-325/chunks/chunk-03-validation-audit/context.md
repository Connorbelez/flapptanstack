# Chunk Context: chunk-03-validation-audit

## Goal
- Run required repository quality gates, run final spec-compliance audit, and close all execution artifacts.

## Relevant plan excerpts
- "Run `bunx convex codegen`, `bun check`, and `bun typecheck`."
- "Before finalizing, invoke `$linear-pr-spec-audit` against the same issue and the current PR or branch diff, then persist the verdict in `specs/<issue-key>/audit.md`."

## Implementation notes
- Any audit `MISSING` or `CONTRADICTED` findings must be fixed or recorded as blockers before claiming completion.
- Run final artifact validator with `--require-audit --require-all-tasks-closed --require-all-checklist-closed`.

## Existing code touchpoints
- Validation commands from `AGENTS.md`: `bunx convex codegen`, `bun check`, `bun typecheck`.

## Validation
- `bun run test -- src/test/convex/brokers/claimConvergence.test.ts`
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- `$linear-pr-spec-audit`
- From the repository root: `python3 "$CODEX_SKILLS_ROOT/linear-implement-v2/scripts/validate_execution_artifacts.py" ENG-325 --repo-root "." --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`
