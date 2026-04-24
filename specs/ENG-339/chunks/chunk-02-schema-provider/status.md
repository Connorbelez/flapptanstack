# Status: chunk-02-schema-provider

- Result: complete
- Last updated: 2026-04-24T18:15:51Z

## Completed tasks
- T-020: Added `checkoutSessions` schema table and indexes.
- T-021: Added `stripe` to type-level provider code constants.
- T-022: Added `stripe` to Convex provider code validator.
- T-023: Ran Convex codegen successfully.
- T-033: Added transfer provider-code tests for `stripe`.
- T-034: Added schema introspection tests for `checkoutSessions`.

## Validation
- `bunx convex codegen`: pass
- `ALLOW_TEST_AUTH_ENDPOINTS=true DISABLE_GT_HASHCHAIN=true DISABLE_CASH_LEDGER_HASHCHAIN=true bunx vitest run convex/checkout/__tests__/status.test.ts convex/checkout/__tests__/validators.test.ts convex/checkout/__tests__/metadata.test.ts convex/checkout/__tests__/schema.test.ts convex/payments/transfers/__tests__/types.test.ts convex/payments/transfers/__tests__/mutations.test.ts convex/payments/transfers/providers/__tests__/registry.test.ts`: pass
- Representative checkout schema/index test: pass

## Notes
- `stripe` is a valid provider literal but remains intentionally unimplemented in the runtime provider registry for this foundational slice.
- `executeTransferOwnedPayout` now narrows its provider argument to exclude `stripe` because that payout bridge does not accept the checkout provider.
