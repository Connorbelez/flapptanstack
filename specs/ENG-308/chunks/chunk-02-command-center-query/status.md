# Status: chunk-02-command-center-query

- Result: complete
- Last updated: 2026-04-21T19:17:01Z

## Completed tasks
- T-100: Added `convex/portfolio/queries.ts` with a `portalLenderQuery` command-center endpoint guarded by `portfolio:view`.
- T-110: Returned stable empty-state-safe cockpit, actions, positions, payment activity, limits, suggestions, source-of-truth, and broker coordination sections from the shared helper layer.

## Validation
- `bun run test -- convex/portfolio/__tests__/queries.test.ts`: passed
- `bun run test -- convex/accrual/__tests__/queryHelpers.test.ts convex/ledger/__tests__/queries.test.ts`: passed

## Notes
- The query should stay backend-only and should not leak route-shell ownership or UI ordering concerns beyond stable DTO section names.
