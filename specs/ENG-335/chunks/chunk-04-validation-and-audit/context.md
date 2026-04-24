# Chunk Context: chunk-04-validation-and-audit

## Goal
- Run required repo gates, targeted suites, final spec audit, audit remediation, final artifact validation, and GitNexus change detection.

## Relevant plan excerpts
- Required validation: `bun check`, `bun typecheck`, targeted route/component tests, and Velocity e2e specs.
- Skill gate: run `$linear-pr-spec-audit` and persist the verdict before claiming completion.

## Implementation notes
- Per repo instructions, run `bun check` before manually fixing formatting/lint issues.
- Run `bunx convex codegen` as a required repository quality gate.
- If a full `bun run test:e2e` is impractical due environment/auth, run the targeted Velocity specs and record the blocker for the full suite.

## Existing code touchpoints
- `specs/ENG-335/audit.md`
- `specs/ENG-335/execution-checklist.md`
- `specs/ENG-335/tasks.md`
- `specs/ENG-335/status.md`
- `specs/ENG-335/chunks/manifest.md`

## Validation
- `bun check`
- `bun typecheck`
- `bunx convex codegen`
- Targeted unit/component tests
- Targeted Playwright tests
- `python3 scripts/validate_execution_artifacts.py ENG-335 --repo-root "/Users/connor/.codex/worktrees/052a/fairlendapp" --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`
