# Chunk Context: chunk-03-tests-audit

## Goal
- Run required repo validation, final spec audit, and artifact closure after implementation chunks are complete.

## Relevant plan excerpts
- "`bunx convex codegen`, `bun check`, `bun typecheck`."
- "Before finalizing, invoke `$linear-pr-spec-audit` against the same issue and the current PR or branch diff, then persist the verdict in `specs/<issue-key>/audit.md`."

## Implementation notes
- Run `bun check` before attempting manual formatting fixes, per repo instructions.
- If audit reports `MISSING` or `CONTRADICTED`, fix and rerun or mark blocked explicitly.
- Run GitNexus change detection before wrap-up.

## Existing code touchpoints
- `specs/ENG-306/audit.md`
- `specs/ENG-306/execution-checklist.md`
- `specs/ENG-306/tasks.md`
- `specs/ENG-306/status.md`
- GitNexus detect changes before finalizing.

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- targeted tests
- final artifact validator with audit and all task/checklist closure
