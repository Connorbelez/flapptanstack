# Chunk Context: chunk-02-export-strip-surface

## Goal
- Replace the ENG-311 lower-strip placeholder with a production leaf component that renders broker-imposed limits and the CSV export action above suggested opportunities.

## Relevant plan excerpts
- "Render the lower limits-plus-export strip above Suggested opportunities."
- "The UI consumes the server-generated export contract from ENG-310 and does not assemble CSV locally."
- "If CSV text is returned, reuse the existing browser download helper pattern from `src/components/admin/financial-ledger/csv.ts`."
- "CSV export should disable with a reason, never a dead button."
- "UI copy remains CSV-first and must not imply PDF, T5, or official tax-document generation."

## Implementation notes
- Keep the lower strip inside the existing page order owned by ENG-311.
- Reuse the existing limits summary data already present on the command-center snapshot.
- The export action should read the pinned ENG-310 tax-export contract from `api.portfolio.queries.getLenderPortfolioTaxExport`.
- Do not reserialize CSV rows in React; trigger a browser download from the server-generated filename and CSV payload only when the contract reports availability.

## Existing code touchpoints
- `src/components/lender/portfolio/LenderPortfolioPage.tsx`
- `src/components/lender/portfolio/fixtures.ts`
- `src/components/admin/financial-ledger/csv.ts`
- `convex/portfolio/contracts.ts`
- `convex/portfolio/queries.ts`
- GitNexus impact analysis will be recorded here before edits start.

## Validation
- `bun run test -- src/test/lender/portfolio-cockpit.test.tsx`
- `convex/portfolio/__tests__/export.test.ts` remains green
- `bun check`
- `bun typecheck`
