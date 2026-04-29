# Chunk Context: chunk-05-validation-audit

## Goal
- Run the repo quality gates, check final scope, and close the implementation through the spec-compliance audit before calling `ENG-311` complete.

## Relevant plan excerpts
- Required commands from the issue: `bunx convex codegen`, `bun check`, `bun typecheck`, `bun run test -- src/test/routes/lender-portfolio-route.test.tsx`, and `bun run test:e2e` if the implementation exercises real auth/routing behavior.
- Workflow requirement: treat `$linear-pr-spec-audit` as a release gate and persist the verdict into `specs/ENG-311/audit.md`.
- Repo instruction: `bun check`, `bun typecheck`, and `bunx convex codegen` must pass before considering tasks completed.

## Implementation notes
- Run `bun check` before trying to hand-fix lint or formatting issues because the repo relies on Biome's autofix behavior.
- After the code is stable, validate the final scope against every checklist item and update `specs/ENG-311/` in the same session as the validation results.
- Use GitNexus scope checks before wrap-up if any existing symbols were edited during implementation; if the final implementation remains additive, record that in the closeout notes.
- Do not mark the audit or final validation complete while `audit.md` still reports `MISSING` or `CONTRADICTED` findings.

## Existing code touchpoints
- `package.json`: source of truth for `bun check`, `bun typecheck`, `bun run test`, and `bun run test:e2e`.
- `specs/ENG-311/audit.md`: persistent record of the final spec audit verdict and unresolved items.
- `scripts/validate_execution_artifacts.py`: final gate for `specs/ENG-311/`.
- `npx gitnexus status` confirmed the repo is indexed locally for later blast-radius and scope checks.

## Validation
- `bunx convex codegen`: pass
- `bun check`: pass
- `bun typecheck`: pass
- `bun run test -- src/test/routes/lender-portfolio-route.test.tsx`: pass
- `bun run test:e2e`: pass or explicitly justified as not practical for this branch
- `python3 /Users/connor/.codex/skills/linear-implement-v2/scripts/validate_execution_artifacts.py ENG-311 --repo-root "/Users/connor/.codex/worktrees/d226/fairlendapp" --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`: pass
