# Chunk 3: Dashboard Components — Metrics and Positions

## Tasks

- [ ] T-020: Add `src/components/mic/MicDashboardMetrics.tsx` rendering `MicPortfolioMetrics` (outstanding principal, active positions, weighted avg yield/LTV, arrears/delinquency exposure).
- [ ] T-021: Add `src/components/mic/MicPositionsTable.tsx` rendering `MicPositionRow[]` with sortable columns, search/filter UI, and row-click handler for drilldown.
- [ ] T-022: Add `src/components/mic/MicPositionDetailDrawer.tsx` using `getMicPositionDetail` / `getMicPaymentsHistory` queries to show mortgage terms, property info, and payment history in a sheet/drawer.
- [ ] T-023: Add `src/components/mic/MicDataWarnings.tsx` banner surfacing `dataCompleteness` and `warnings` from the MIC portfolio envelope without inventing metrics.
