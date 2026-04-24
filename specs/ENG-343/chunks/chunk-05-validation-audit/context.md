# Chunk Context: chunk-05-validation-audit

## Goal
- Run all repository quality gates, run the final Linear spec audit, fix or record findings, and validate local execution artifacts.

## Relevant plan excerpts
- Required validation: `bunx convex codegen`, `bun check`, `bun typecheck`, targeted close/transfer tests, `bun run test`, and `bun run review`.
- Final audit must be persisted in `specs/ENG-343/audit.md`.
- Do not claim complete while audit has unresolved `MISSING` or `CONTRADICTED` items.

## Implementation notes
- `bun check` must run before manual lint/format fixes because it may auto-format.
- GitNexus change detection is required before wrap-up.
- If e2e or Storybook are inapplicable, the reason must be recorded in the checklist/status.

## Existing code touchpoints
- `specs/ENG-343/audit.md`
- `specs/ENG-343/status.md`
- `specs/ENG-343/execution-checklist.md`
- `specs/ENG-343/tasks.md`

## Validation
- Final artifact validation with `--require-audit --require-all-tasks-closed --require-all-checklist-closed`.
