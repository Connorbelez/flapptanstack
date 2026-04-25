# Chunk Context: chunk-05-tests-validation

## Goal
- Complete e2e coverage, repository quality gates, final spec audit, and final execution artifact validation.

## Relevant plan excerpts
- Required commands: `bunx convex codegen`, `bun check`, `bun typecheck`, targeted lawyer route/query/mutation tests, `bun run test`, `bun run test:e2e`, `bun run review`.
- Before finalizing, invoke `$linear-pr-spec-audit` against ENG-347 and persist the verdict in `specs/ENG-347/audit.md`.
- Do not claim complete while audit has unresolved `MISSING` or `CONTRADICTED` items.

## Implementation notes
- Add or update seeded e2e coverage only after route and backend flows exist.
- If Storybook is not appropriate for the new route-level UI, record that in the checklist and audit notes.
- Run `python3 scripts/validate_execution_artifacts.py ENG-347 --repo-root "<repo-root>" --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed` before final completion claim.
- Run GitNexus detect changes before wrap-up.

## Existing code touchpoints
- E2E directory: `e2e/` or current Playwright test convention after inspection.
- Artifact files under `specs/ENG-347/`.
- Audit skill: `$linear-pr-spec-audit`.

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- targeted tests
- `bun run test`
- `bun run test:e2e`
- `bun run review`
- `$linear-pr-spec-audit`
- final artifact validator
- GitNexus detect changes
