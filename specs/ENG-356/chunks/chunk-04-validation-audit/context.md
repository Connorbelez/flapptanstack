# Chunk Context: chunk-04-validation-audit

## Goal
- Run required repository gates, final spec audit, and artifact validation.

## Relevant plan excerpts
- Final gate requires `$linear-pr-spec-audit` against ENG-356 and the current branch diff.
- Required repository commands: `bunx convex codegen`, `bun check`, `bun typecheck`.

## Implementation notes
- Run targeted tests before broader gates.
- Persist audit result in `specs/ENG-356/audit.md`.
- If audit finds `MISSING` or `CONTRADICTED` items, fix and rerun audit or mark blocked.

## Existing code touchpoints
- `specs/ENG-356/audit.md`
- `scripts/validate_execution_artifacts.py`
- GitNexus change detection via CLI fallback if MCP tool remains unavailable.

## Validation
- `bunx convex codegen`: not-run
- `bun check`: not-run
- `bun typecheck`: not-run
- final artifact validation: not-run
