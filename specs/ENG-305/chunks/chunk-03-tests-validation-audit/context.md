# Chunk Context: chunk-03-tests-validation-audit

## Goal
- Prove the landing renderer meets ENG-305 requirements, run quality gates, and persist final spec-audit verdict.

## Relevant plan excerpts
- "Add or update route/component coverage for the portal root renderer."
- "Run targeted browser verification on a broker portal host and the FairLend `app` portal host."
- "Before finalizing, invoke `$linear-pr-spec-audit` against the same issue and the current PR or branch diff."

## Implementation notes
- Existing `src/test/routes/portal-home-route.test.tsx` is the likely primary test target.
- Tests should assert contract query consumption, approved IA labels, teaser disabled/empty states, and absence of generic diagnostic page content.
- Required repo gates from AGENTS: `bun check`, `bun typecheck`, `bunx convex codegen`.
- Final artifact validation must require audit and all checklist/tasks closed.

## Existing code touchpoints
- `src/test/routes/portal-home-route.test.tsx`
- Additional root/header route test if needed for shared header suppression.
- `specs/ENG-305/audit.md`

## Validation
- `bun run test -- src/test/routes/portal-home-route.test.tsx`
- `bun check`
- `bun typecheck`
- `bunx convex codegen`
- `python3 scripts/validate_execution_artifacts.py ENG-305 --repo-root "/Users/connor/.codex/worktrees/3f9e/fairlendapp" --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`
