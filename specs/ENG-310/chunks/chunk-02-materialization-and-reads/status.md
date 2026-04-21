# Status: chunk-02-materialization-and-reads

- Result: complete
- Last updated: 2026-04-21T20:08:18Z

## Completed tasks
- T-100: Implemented idempotent snapshot materialization and completed-period runners in `convex/portfolio/snapshots.ts`.
- T-110: Wired the daily lender portfolio snapshot materialization cron in `convex/crons.ts`.
- T-120: Published lender historical-series reads with explicit snapshot-versus-live completeness metadata.
- T-130: Published the server-generated CSV export contract and updated the portfolio source-of-truth descriptions.

## Validation
- `bun run test -- convex/portfolio/__tests__/snapshots.test.ts`: passed
- `bun run test -- convex/portfolio/__tests__/export.test.ts`: passed
- `bun run test -- convex/portfolio/__tests__/queries.test.ts`: passed

## Notes
- Materialized snapshots include zero-position years when income exists so exited historical periods still retain lender income.
- The local GitNexus index did not resolve the new untracked symbols in this chunk after reindexing, so closeout risk assessment relied on the focused module boundary plus the passing test suite.
