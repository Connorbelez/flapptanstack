# Chunk Context: chunk-05-validation-audit

## Goal
- Run required quality gates, validate execution artifacts, run the final spec audit, and fix or record any audit findings.

## Relevant plan excerpts
- Required commands: `bunx convex codegen`, `bun check`, `bun typecheck`, `bun run test -- convex/fileWorkspace src/test/convex/fileWorkspace src/test/auth`, and `bun run test` if shared schema/auth changes are broad.

## Implementation notes
- Run `scripts/validate_execution_artifacts.py` for final stage with audit and all tasks/checklist closed before claiming completion.
- Run GitNexus detect changes before wrapping up.
- Persist audit verdict in `specs/ENG-366/audit.md`.

## Existing code touchpoints
- `specs/ENG-366/audit.md`
- `specs/ENG-366/status.md`
- `specs/ENG-366/execution-checklist.md`
- `specs/ENG-366/tasks.md`
- `specs/ENG-366/chunks/manifest.md`

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- focused tests
- final artifact validation
- `$linear-pr-spec-audit`
