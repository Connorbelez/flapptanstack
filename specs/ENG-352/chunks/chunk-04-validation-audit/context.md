# Chunk Context: chunk-04-validation-audit

## Goal
- Run repository quality gates, validate execution artifacts, run final spec audit, and resolve or record audit findings.

## Relevant plan excerpts
- Required commands: `bunx convex codegen`, `bun check`, `bun typecheck`, targeted permission/catalog tests, targeted portal tests, and route tests.
- The final `$linear-pr-spec-audit` is a release gate; unresolved missing or contradicted items block completion claims.

## Implementation notes
- Run `bun check` before manually fixing lint/format issues because it may auto-format.
- Run GitNexus change detection before final wrap-up.
- E2E and Storybook are not expected for this foundational non-UI slice; record that in artifacts and final notes.

## Existing code touchpoints
- `scripts/validate_execution_artifacts.py`.
- `specs/ENG-352/audit.md`.
- Package scripts in `package.json`.

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- targeted test commands selected from touched files
- `python3 scripts/validate_execution_artifacts.py ENG-352 --repo-root ... --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`
