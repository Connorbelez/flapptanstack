# Chunk: chunk-02-schema-provider

- [x] T-020: Add `checkoutSessions` to `convex/schema.ts` with required fields and indexes.
- [x] T-021: Extend `PROVIDER_CODES` and `ProviderCode` in `convex/payments/transfers/types.ts` with `stripe`.
- [x] T-022: Extend `providerCodeValidator` in `convex/payments/transfers/validators.ts` with `stripe`.
- [x] T-023: Run `bunx convex codegen` and verify generated Convex API includes `checkoutSessions`.
- [x] T-033: Add transfer provider-code tests covering `locking_fee_collection` with `stripe`.
- [x] T-034: Add representative Convex schema/index coverage for `checkoutSessions` if the local test harness supports schema queries cleanly.
