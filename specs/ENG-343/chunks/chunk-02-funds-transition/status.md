# Status: chunk-02-funds-transition

- Result: complete
- Last updated: 2026-04-24T17:59:53-04:00

## Completed tasks
- T-020: `confirmFundsReceipt` now resolves payload or provider evidence, records durable evidence, handles compatible replay, and records safe exceptions for missing/invalid evidence.
- T-021: Added `confirmManualFundsReceipt` admin mutation with state, note, timestamp, attachment, and actor validation before governed `FUNDS_RECEIVED`.
- T-022: Leg 2 seller payout confirmation now carries transfer-pipeline evidence into the governed deal transition payload.
- T-023: Missing, mismatched, incompatible duplicate, cancelled/failed, and non-confirmed provider evidence paths are rejected or recorded as close exceptions without direct status patches.

## Validation
- `bun run test convex/deals/__tests__/closeEvidence.test.ts`: passed
- `bun run test convex/deals/__tests__/closeEvidence.test.ts convex/deals/__tests__/effects.test.ts convex/deals/__tests__/dealClosing.test.ts convex/payments/transfers/__tests__/outboundFlow.integration.test.ts`: passed
- `bun run test`: passed

## Notes
- Raw `bun test` is not the repo runner for adjacent suites because some tests rely on Vitest/Vite features; targeted validation used `bun run test ...`.
