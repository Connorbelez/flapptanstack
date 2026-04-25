# Chunk Context: chunk-03-tests-validation-audit

## Goal
- Prove route handoff behavior, run quality gates, run final spec audit, and close tracking artifacts accurately.

## Relevant plan excerpts
- "Add or update targeted tests for financing-route handoff, pre-approval continuation, and explicit portal attribution."
- "Browser-test anonymous and authenticated continuation on a broker portal host."
- "Before finalizing, invoke `$linear-pr-spec-audit` against the same issue and the current PR or branch diff."

## Implementation notes
- Required repo gates from AGENTS: run `bun check` first before manual lint/format fixes, then `bun typecheck` and `bunx convex codegen`.
- Add backend tests only if backend create/resume code changes.
- Add E2E only if the final implementation changes a real browser workflow beyond route/component behavior that is already covered.
- Storybook is only required if a reusable UI component or meaningful standalone UI state is introduced.

## Existing code touchpoints
- `src/test/routes/portal-home-route.test.tsx` for landing root behavior.
- Add focused route tests for `/financing/start` and `/financing/pre-approval` once route files exist.
- Final audit must be persisted in `specs/ENG-307/audit.md`.

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- Targeted Vitest suites for touched route/component/backend behavior.
- `$linear-pr-spec-audit` with result saved to `audit.md`.
