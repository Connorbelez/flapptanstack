# Status: chunk-02-queries

- Result: complete
- Last updated: 2026-04-26T01:19:00-04:00

## Completed tasks
- T-020: Added public fluent MIC query builders.
- T-021: Added MIC-local ledger position helper keyed by `portal.micLenderAuthId`.
- T-022: Added dashboard, positions, detail, payments/history, concentration, maturity, weighted-average, arrears, and warning projections.
- T-023: Registered MIC modules in `convex/test/moduleMaps.ts`.

## Validation
- `bunx convex codegen`: passed
- `bun run test convex/micPortfolio/__tests__/queries.test.ts`: passed

## Notes
- Do not edit `listActiveLenderPositionAccounts` or `PortalBuilder`.
- Chunk started after completing contract validators.
