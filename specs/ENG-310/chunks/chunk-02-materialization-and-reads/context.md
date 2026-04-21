# Chunk Context: chunk-02-materialization-and-reads

## Goal
- Implement the actual snapshot write path plus the lender-facing history and export reads that downstream cockpit and CSV UI surfaces will consume.
- Keep historical recomputation out of the route layer by pushing period shaping and export generation into server-owned portfolio modules.

## Relevant plan excerpts
- "Publish historical-series reads for cockpit charts without exposing raw snapshot rows to the UI."
- "Publish the server-generated CSV export contract with the exact availability and payload fields listed above."
- "Make current-period fallback and data completeness explicit in the contract."
- "No snapshot generation pipeline exists yet, so live queries remain authoritative until cron materialization is implemented."

## Implementation notes
- Historical position math should use ledger point-in-time seams rather than current balances only. `convex/ledger/queries.ts` already exposes `getBalanceAt`, and accrual helpers already compute historical ownership through `getOwnershipPeriods(...)`, which matters for exited-position historical years.
- `convex/portfolio/helpers.ts` currently marks `historicalChartInputs` and `csvTaxExportInputs` as ENG-310 placeholders in `PORTFOLIO_SOURCE_OF_TRUTH`; this chunk should replace those placeholders with real portfolio history and export seams.
- Cron wiring belongs in the existing static `convex/crons.ts` schedule file unless a stronger repo-local pattern emerges while implementing the internal snapshot runner.
- The export read should hand back ready-to-download CSV text and a reason when unavailable so `ENG-313` can reuse the existing browser download helper pattern without rebuilding rows in React.

## Existing code touchpoints
- `convex/crons.ts`
- `convex/ledger/queries.ts`
- `convex/accrual/queryHelpers.ts`
- `convex/accrual/ownershipPeriods.ts`
- `convex/portfolio/helpers.ts`
- `convex/portfolio/queries.ts`

## Validation
- `bun run test -- convex/portfolio/__tests__/snapshots.test.ts`
- `bun run test -- convex/portfolio/__tests__/export.test.ts`
- `bun run test -- convex/portfolio/__tests__/queries.test.ts`
