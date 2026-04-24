# Chunk Context: chunk-04-tests-validation-audit

## Goal
- Add focused automated coverage, run required quality gates, and complete the final spec audit.

## Relevant plan excerpts
- "Component tests for board row/status rendering and immutable-vs-editable section presentation."
- "Route/render tests for board and workspace pages under admin auth guards."
- "Integration tests for document upload/link affordances, sync-now triggering, and remediation-state rendering."

## Implementation notes
- Prefer Vitest/React Testing Library tests under `src/test/admin/velocity`.
- Mock `convex/react` hooks for component tests, consistent with existing admin component tests.
- Extend existing auth tests in `src/test/auth/route-guards.test.ts`.
- E2E is likely not appropriate until ENG-335/mock harness wiring; record if skipped.
- Storybook is not expected for composed pages.

## Existing code touchpoints
- `src/test/admin/velocity/workspace.test.tsx`: create.
- `src/test/auth/route-guards.test.ts`: modify.
- `specs/ENG-336/audit.md`: update after `$linear-pr-spec-audit`.
- GitNexus impact required before editing existing test symbols only if modifying existing helper functions; adding assertions in an existing test file has low blast radius but still check changed-symbol impact where possible.

## Validation
- `bun check`
- `bun typecheck`
- `bunx convex codegen`
- targeted tests
- `$linear-pr-spec-audit`
