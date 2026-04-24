# Status: chunk-02-prepare-and-compensate

- Result: complete
- Last updated: 2026-04-24T20:38:10Z

## Completed tasks
- T-020
- T-021
- T-022
- T-023

## Validation
- Focused checkout and ledger tests passed: `ALLOW_TEST_AUTH_ENDPOINTS=true DISABLE_GT_HASHCHAIN=true DISABLE_CASH_LEDGER_HASHCHAIN=true bunx vitest run convex/checkout/__tests__/start.test.ts convex/checkout/__tests__/types.test.ts convex/checkout/__tests__/stripe.test.ts convex/checkout/__tests__/metadata.test.ts convex/checkout/__tests__/validators.test.ts convex/ledger/__tests__/reservation.test.ts`.
- `bun check`, `bun typecheck`, and `bunx convex codegen` passed after the implementation.

## Notes
- Runtime risk high: this chunk owns ledger reservation consistency.
- Provider-start compensation uses `voidReservationHandler`, leaving the reservation voided and the checkout session in `provider_start_failed` with `failureReason`.
