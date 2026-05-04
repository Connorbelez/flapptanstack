# Chunk: chunk-02-queries

- [x] T-020: Add `convex/micPortfolio/queries.ts` public fluent queries guarded by `authMiddleware`, `requirePermission("mic:access")`, and MIC portal config resolution.
- [x] T-021: Add MIC-specific helper logic to load positive posted position accounts by canonical `micLenderAuthId` without changing shared lender portfolio helpers.
- [x] T-022: Build dashboard, positions, detail, payments/history, concentration, maturity ladder, weighted averages, arrears/delinquency exposure, and incomplete cash-ledger warnings from ledger/mortgage/payment records only.
- [x] T-023: Register the new MIC portfolio modules in `convex/test/moduleMaps.ts` if the test harness requires explicit module loading.
