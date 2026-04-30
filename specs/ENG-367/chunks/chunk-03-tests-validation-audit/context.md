# Chunk Context: chunk-03-tests-validation-audit

## Goal
- Run required repo gates, the final spec audit, GitNexus change detection, and final artifact validation.

## Relevant plan excerpts
- Required commands: `bunx convex codegen`, `bun check`, `bun typecheck`, `bun run test -- convex/fileWorkspace src/test/convex/fileWorkspace`.
- Run `$linear-pr-spec-audit` before claiming completion.
- Run GitNexus detect changes before wrapping up.

## Implementation notes
- Run `bun check` before manual formatting fixes if any appear.
- Persist audit verdict in `specs/ENG-367/audit.md`.
- E2E and Storybook are not applicable because this slice has no route/UI changes.

## Existing code touchpoints
- `specs/ENG-367/*` execution artifacts.
- `convex/fileWorkspace/*` implementation and tests from prior chunks.

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- `bun run test -- convex/fileWorkspace src/test/convex/fileWorkspace`
- `python3 /Users/connor/.codex/skills/linear-implement-v2/scripts/validate_execution_artifacts.py ENG-367 --repo-root "/Users/connor/.codex/worktrees/a568/fairlendapp" --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`
