# Status: chunk-02-portal-scheduler

- Result: complete
- Last updated: 2026-04-21T19:14:28Z

## Completed tasks
- T-020
- T-021
- T-022

## Validation
- targeted renewal portal and scheduler tests: passed via `bun run test -- src/test/convex/renewals/portal.test.ts`
- `bunx convex codegen`: passed

## Notes
- Keep the public surface thin and downstream-consumable so later lender-portfolio UI issues do not need to edit engine hot spots.
- Renewal creation uses mortgage maturity windows plus live ledger position ownership, and expiry reuses `internal.engine.transitionMutation.transitionMutation` with scheduler sources instead of patching governed state directly.
