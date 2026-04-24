# Chunk Context: chunk-04-tests-and-validation

## Goal
- Prove checkout start behavior and complete repository/spec validation.

## Relevant plan excerpts
- Race tests prove no oversell and no dangling second reservation.
- Required commands: `bunx convex codegen`, `bun check`, `bun typecheck`.
- Run `$linear-pr-spec-audit` and persist verdict in `audit.md`.

## Implementation notes
- Use convex-test patterns from ledger and checkout contract tests.
- E2E redirect tests are deferred to UI/hardening issues; record this explicitly.
- Storybook is not applicable unless UI components are changed.

## Existing code touchpoints
- `convex/checkout/__tests__/*`
- `convex/ledger/__tests__/reservation.test.ts`
- `convex/listings/__tests__/marketplace.test.ts`

## Validation
- Targeted checkout tests, ledger reservation tests if shared helpers change, `bunx convex codegen`, `bun check`, `bun typecheck`, final artifact validation, spec audit.
