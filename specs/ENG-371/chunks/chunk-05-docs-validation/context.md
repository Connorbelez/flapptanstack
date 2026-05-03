# Chunk Context: chunk-05-docs-validation

## Goal
- Document the fixture and close the issue with validation, audit, and final artifact checks.

## Relevant plan excerpts
- Document local fixture creation, commands, screenshots, and troubleshooting.
- Required commands: `bunx convex codegen`, `bun check`, `bun typecheck`, targeted tests, E2E suite, and full `bun run test`.
- Run `$linear-pr-spec-audit` and persist results in `specs/ENG-371/audit.md`.

## Implementation notes
- Prefer `docs/architecture/file-workspace.md` or a similarly focused doc.
- Record any intentionally inapplicable Storybook coverage in the checklist and final report.
- Do not mark final complete while audit has unresolved `MISSING` or `CONTRADICTED` items.

## Existing code touchpoints
- `docs/architecture/*`
- `specs/ENG-371/audit.md`
- execution artifact files under `specs/ENG-371`

## Validation
- Full required validation list from `tasks.md`.
- `python3 /Users/connor/.codex/skills/linear-implement-v2/scripts/validate_execution_artifacts.py ENG-371 --repo-root "/Users/connor/.codex/worktrees/7d59/fairlendapp" --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`
