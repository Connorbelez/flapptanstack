# Chunk Context: chunk-04-validation-audit

## Goal
- Run required repo quality gates, final artifact validation, GitNexus change detection, and the Linear spec audit.

## Relevant plan excerpts
- Required commands: `bunx convex codegen`, `bun check`, `bun typecheck`, targeted MIC tests, existing onboarding tests when shared audit or transition validators change.
- Final `$linear-pr-spec-audit` is a release gate and must be persisted to `specs/ENG-353/audit.md`.

## Implementation notes
- Run `bun check` before manually fixing lint/format fallout.
- Do not mark final checklist complete until validation supports it.
- If audit reports MISSING or CONTRADICTED items, fix and rerun or explicitly record blocker.

## Existing code touchpoints
- `specs/ENG-353/audit.md`
- `specs/ENG-353/status.md`
- `specs/ENG-353/execution-checklist.md`

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- targeted MIC request tests
- onboarding regression tests
- final artifact validation with `--require-audit --require-all-tasks-closed --require-all-checklist-closed`
- GitNexus detect changes
