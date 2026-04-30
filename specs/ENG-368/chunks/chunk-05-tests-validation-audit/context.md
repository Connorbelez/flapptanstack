# Chunk Context: chunk-05-tests-validation-audit

## Goal
- Close coverage, run quality gates, run spec audit, and verify changed scope.

## Relevant plan excerpts
- Required commands: `bunx convex codegen`, `bun check`, `bun typecheck`, `bun run test -- convex/fileWorkspace src/test/convex/fileWorkspace src/test/auth`, and `bun run test` if shared auth/policy modules change.
- E2E journeys are covered by ENG-371 unless needed to prove auth wiring.
- Do not claim complete while the audit has unresolved `MISSING` or `CONTRADICTED` items.

## Implementation notes
- No Storybook or E2E should be added unless the backend implementation unexpectedly changes UI surface or browser auth wiring.
- Run `bun check` before manual lint fixes because it auto-formats/fixes some issues.
- Persist audit verdict in `specs/ENG-368/audit.md`.
- Run GitNexus change detection before closeout.

## Existing code touchpoints
- All implementation chunks.
- Execution artifacts under `specs/ENG-368`.

## Validation
- `python3 /Users/connor/.codex/skills/linear-implement-v2/scripts/validate_execution_artifacts.py ENG-368 --repo-root "/Users/connor/.codex/worktrees/5ee6/fairlendapp" --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`
