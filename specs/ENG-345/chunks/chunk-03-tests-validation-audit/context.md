# Chunk Context: chunk-03-tests-validation-audit

## Goal
- Prove checkout expiry and abandonment satisfy the Linear requirements, then run repo validation and the mandatory spec audit.

## Relevant plan excerpts
- "Race/idempotency tests cover duplicate sweeps and success-vs-expiry conflict."
- "Required commands: `bunx convex codegen`, `bun check`, `bun typecheck`, targeted checkout expiry convex tests, targeted ledger reservation tests."

## Implementation notes
- Existing checkout tests use `convex-test`, `registerAuditLogComponent`, `api`, and `internal` from generated Convex modules.
- Prefer adding a focused `convex/checkout/__tests__/expiry.test.ts` unless a smaller extension to existing tests is clearer.
- No browser E2E or Storybook changes are expected because this issue has no UI.

## Existing code touchpoints
- `convex/checkout/__tests__/start.test.ts`: fixture patterns for users, ledgers, listings, reservations, and Stripe fake fetch.
- `convex/ledger/__tests__/reservation.test.ts`: canonical reservation behavior.
- `scripts/validate_execution_artifacts.py`: final artifact gate.

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- Targeted checkout expiry tests
- Targeted ledger reservation tests when not fully covered by checkout tests
- `$linear-pr-spec-audit` persisted to `specs/ENG-345/audit.md`
