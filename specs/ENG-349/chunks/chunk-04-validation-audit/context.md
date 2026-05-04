# Chunk Context: chunk-04-validation-audit

## Goal
- Run required repository quality gates, final spec audit, and artifact validation.

## Relevant plan excerpts
- Required commands: `bunx convex codegen`, `bun check`, `bun typecheck`.
- Run targeted checkout-to-deal convex tests, targeted deal package tests, targeted deal access tests.
- Before finalizing, invoke `$linear-pr-spec-audit` and persist the verdict in `specs/ENG-349/audit.md`.

## Implementation notes
- `bun check` must be run before manual lint/format fixes because it writes formatting changes.
- E2E and Storybook are expected to be inapplicable unless implementation scope changes into UI.
- Run GitNexus change detection before closeout.

## Existing code touchpoints
- `specs/ENG-349/audit.md`
- `specs/ENG-349/execution-checklist.md`
- `specs/ENG-349/status.md`

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- targeted tests
- possible `bun run test`
- `python3 scripts/validate_execution_artifacts.py ENG-349 --repo-root "/Users/connor/.codex/worktrees/b267/fairlendapp" --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`
