# Chunk Context: chunk-05-validation-audit

## Goal
- Run required repository validation, final spec audit, artifact closure, and GitNexus change detection.

## Relevant plan excerpts
- Required commands: `bunx convex codegen`, `bun check`, `bun typecheck`, `bun run test -- src/test/file-workspace src/test/routes`, and broader `bun run test` if shared route/auth primitives change.
- "Before finalizing, invoke `$linear-pr-spec-audit` against the same issue and the current PR or branch diff, then persist the verdict in `specs/<issue-key>/audit.md`."

## Implementation notes
- `bun check` must run before manual formatting/lint fixes.
- If audit returns `MISSING` or `CONTRADICTED`, fix and rerun or explicitly mark blockers.
- Final artifact validation requires all tasks/checklist items closed and audit present.

## Existing code touchpoints
- `specs/ENG-370/audit.md`.
- `scripts/validate_execution_artifacts.py` from the `linear-implement-v2` skill.
- GitNexus detect changes via CLI or MCP, depending on availability.

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- `bun run test -- src/test/file-workspace src/test/routes`
- final `validate_execution_artifacts.py ENG-370 --require-audit --require-all-tasks-closed --require-all-checklist-closed`
