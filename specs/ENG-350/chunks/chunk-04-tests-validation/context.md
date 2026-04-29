# Chunk Context: chunk-04-tests-validation

## Goal
- Complete test coverage, quality gates, final audit, and scope verification.

## Relevant plan excerpts
- "`bun check`, `bun typecheck`, and relevant tests pass; run codegen if API refs changed."
- "Before finalizing, invoke `$linear-pr-spec-audit` against the same issue and the current PR or branch diff."

## Implementation notes
- Required project gates are `bunx convex codegen`, `bun check`, and `bun typecheck`.
- Add targeted Vitest/RTL coverage for the UI behavior in this issue.
- E2E is optional for this slice if mocked RTL route coverage proves the redirect handoff without depending on Stripe/webhook infrastructure; record the decision.
- Storybook is optional unless a reusable component story surface already exists or a new reusable component is introduced; record the decision.

## Existing code touchpoints
- `src/test/listings/*`
- `src/test/routes/listings-route.test.tsx` if route behavior changes.
- `specs/ENG-350/audit.md`, task/checklist/status artifacts.

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- targeted `bun run test` invocation for listing/route tests.
- `$linear-pr-spec-audit ENG-350`
- `python3 scripts/validate_execution_artifacts.py ENG-350 --repo-root "/Users/connor/.codex/worktrees/ab93/fairlendapp" --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`
- GitNexus diff impact detection before wrap-up.
