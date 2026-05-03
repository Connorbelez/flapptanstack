# Chunk Context: chunk-01-cockpit-surface

## Goal
- Replace the ENG-311 cockpit placeholder with a production leaf component that renders KPI cards, trend charts, and breakdown visuals at the top of `/lender/portfolio` using upstream command-center and history contracts.

## Relevant plan excerpts
- "Render KPI cards and chart surfaces at the top of `/lender/portfolio`."
- "The expected export contract fields are: `isAvailable`, `unavailableReason?`, `filename?`, `csv?`, `generatedAt`, `periodLabel`, and `dataCompleteness`."
- "The cockpit must consume snapshot/live completeness metadata from `ENG-310` instead of inferring it locally."
- "The top section uses a premium financial-dashboard treatment with KPI cards for YTD, monthly, lifetime, and risk/renewal summary, plus line graphs for profit-to-date and projected aggregate earnings, and portfolio breakdown pies."

## Implementation notes
- The shipped cockpit uses direct `recharts` primitives inside `src/components/lender/portfolio/portfolio-cockpit.tsx` for the composed income trend and breakdown pies, while still using the shared design-system card/badge/empty primitives around the chart surfaces.
- Prefer additive leaf components and helpers under `src/components/lender/portfolio/`; keep route ownership in `src/routes/lender.portfolio.tsx` untouched.
- The existing command-center snapshot already includes KPI metrics and breakdown data; the historical series must come from `api.portfolio.queries.getLenderPortfolioHistoricalSeries`.
- Loading, empty, and error chart states must preserve the page layout instead of collapsing the top section.

## Existing code touchpoints
- `src/components/lender/portfolio/LenderPortfolioPage.tsx`
- `src/components/lender/portfolio/portfolio-formatters.ts`
- `src/components/lender/portfolio/fixtures.ts`
- `src/components/ui/chart.tsx`
- `convex/portfolio/contracts.ts`
- `convex/portfolio/queries.ts`
- GitNexus impact: `LenderPortfolioPage` is `LOW` risk with `0` direct upstream callers and `0` affected execution flows in the refreshed worktree index.

## Validation
- `bun run test -- src/test/lender/portfolio-cockpit.test.tsx`
- `bun check`
- `bun typecheck`
