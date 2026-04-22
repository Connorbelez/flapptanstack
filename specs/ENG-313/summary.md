# Summary: ENG-313 - Lender portfolio: ship cockpit charts and CSV tax export surfaces

- Source issue: https://linear.app/fairlend/issue/ENG-313/lender-portfolio-ship-cockpit-charts-and-csv-tax-export-surfaces
- Primary plan: https://www.notion.so/349fc1b4402481928639f6c6884c32ae
- Supporting docs:
- https://www.notion.so/318fc1b4402481cda6dfc6381b99d9fb
- https://www.notion.so/349fc1b44024815a8e01d57ccc4a53f8
- https://www.notion.so/349fc1b44024815d9f24e9f7625bb88e

## Scope
- Replace the ENG-311 cockpit placeholder in `src/components/lender/portfolio/LenderPortfolioPage.tsx` with a dedicated `portfolio-cockpit.tsx` leaf surface that renders KPI cards, trend charts, and portfolio breakdown visuals at the top of `/lender/portfolio`.
- Replace the ENG-311 lower-strip placeholder with a dedicated `portfolio-export-strip.tsx` leaf surface that renders broker-imposed limits alongside a server-driven CSV tax export action above suggested opportunities.
- Extend the upstream portfolio snapshot and historical-series contracts with `projectedAggregateEarnings` so the cockpit can render the approved projection trend without recomputing financial math in React.
- Consume upstream command-center, historical-series, and tax-export contracts without assembling CSV data in React.
- Add focused component coverage and Storybook coverage for cockpit and export-strip states, plus the required repo validation and final audit closeout.

## Constraints
- Do not modify route ownership in `src/routes/lender.portfolio.tsx`, the baseline route test ownership, or the shared route/query seam beyond what is strictly necessary for this leaf-consumer slice.
- The cockpit must consume upstream completeness metadata and historical-series contracts from ENG-310 rather than inferring completeness or rebuilding chart math locally.
- The export flow must consume the exact server-generated contract fields `isAvailable`, `unavailableReason?`, `filename?`, `csv?`, `generatedAt`, `periodLabel`, and `dataCompleteness`.
- Reuse the browser download helper pattern from `src/components/admin/financial-ledger/csv.ts`; do not generate CSV rows in React.
- Keep the approved page order intact: cockpit first, lower limits-plus-export strip above suggested opportunities, and no new performance or tax routes.
- Keep loading, empty, disabled, and error states layout-safe.
- UI copy must stay CSV-first and must not imply PDF generation, T5 issuance, or official tax-document generation.

## Open questions
- none
