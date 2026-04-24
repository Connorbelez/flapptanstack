# Chunk Context: chunk-03-tests-validation

## Goal
- Run required quality gates, final spec audit, and execution artifact closeout.

## Relevant plan excerpts
- Required commands: `bunx convex codegen`, `bun check`, `bun typecheck`, targeted checkout validator/status tests, targeted transfer provider tests.
- Before finalizing, run `$linear-pr-spec-audit` against ENG-339 and persist the verdict in `specs/ENG-339/audit.md`.
- Do not claim complete while the audit has unresolved `MISSING` or `CONTRADICTED` items.

## Implementation notes
- Run `bun check` before manual lint formatting fixes because repo guidance says it auto-formats and fixes some lint issues.
- E2E and Storybook are not applicable to this contract-only backend slice; keep that documented in the checklist.
- Run `gitnexus_detect_changes` equivalent before final wrap-up.

## Existing code touchpoints
- `specs/ENG-339/audit.md`, `specs/ENG-339/tasks.md`, `specs/ENG-339/execution-checklist.md`, and chunk statuses must be kept current.
- Use current branch diff as review target if no open PR exists.

## Validation
- `bunx convex codegen`: not-run
- `bun check`: not-run
- `bun typecheck`: not-run
- `bun run test`: not-run
- `$linear-pr-spec-audit`: not-run
- `python3 /Users/connor/.codex/skills/linear-implement-v2/scripts/validate_execution_artifacts.py ENG-339 --repo-root "/Users/connor/.codex/worktrees/364d/fairlendapp" --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`: not-run
