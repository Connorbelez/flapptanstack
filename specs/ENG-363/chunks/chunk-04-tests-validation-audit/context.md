# Chunk Context: chunk-04-tests-validation-audit

## Goal
- Run quality gates, perform spec audit, fix findings or record blockers, and finalize artifacts.

## Relevant Plan Excerpts
- Required commands: `bunx convex codegen`, `bun check`, `bun typecheck`, targeted legalRepresentation gate tests, targeted lawyer workspace tests, targeted engine transition tests, `bun run test` when transition behavior or admin transition path changes.

## Implementation Notes
- Run `bun check` before manual lint fixes because it auto-formats/fixes some issues.
- Persist `$linear-pr-spec-audit` verdict in `audit.md`.
- Run final artifact validator with audit and closed task/checklist requirements only after code/test evidence supports completion.

## Existing Code Touchpoints
- `specs/ENG-363/audit.md`
- `specs/ENG-363/status.md`
- `specs/ENG-363/execution-checklist.md`
- `specs/ENG-363/tasks.md`

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- targeted tests
- `bun run test` if needed
- `python3 scripts/validate_execution_artifacts.py ENG-363 --repo-root "/Users/connor/.codex/worktrees/7c70/fairlendapp" --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`
