# Status: chunk-01-schema-and-contracts

- Result: complete
- Last updated: 2026-04-21T20:08:18Z

## Completed tasks
- T-010: Added the `by_lender_snapshot` index so monthly and year-end snapshots can coexist on the same business date without ambiguous reads.
- T-020: Added explicit portfolio history and tax-export validators in `convex/portfolio/contracts.ts`.
- T-030: Landed shared snapshot and export helpers in `convex/portfolio/snapshots.ts`, `convex/portfolio/history.ts`, and `convex/portfolio/export.ts`.

## Validation
- `bunx convex codegen`: passed
- `bun run test -- convex/portfolio/__tests__/queries.test.ts`: passed as part of the focused portfolio suite

## Notes
- GitNexus impact analysis is complete and `LOW` risk for the planned shared touchpoints in this chunk.
- `buildPortfolioCommandCenter` reports one direct caller in `convex/portfolio/queries.ts`; `getLenderPortfolioCommandCenter`, `portfolioCommandCenterValidator`, and `PORTFOLIO_SOURCE_OF_TRUTH` do not show broader upstream dependents in the current indexed worktree.
