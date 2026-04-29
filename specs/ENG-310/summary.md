# Summary: ENG-310 - Lender portfolio: materialize historical snapshots and CSV export contracts

- Source issue: https://linear.app/fairlend/issue/ENG-310/lender-portfolio-materialize-historical-snapshots-and-csv-export
- Primary plan: https://www.notion.so/349fc1b4402481df87acf4970532e0a5
- Supporting docs:
- https://www.notion.so/318fc1b4402481cda6dfc6381b99d9fb
- https://www.notion.so/349fc1b4402481928639f6c6884c32ae

## Scope
- Turn `portfolioSnapshots` from a placeholder table into a real materialized backend seam with deterministic identity by lender, business date, and snapshot type.
- Implement idempotent monthly and year-end snapshot generation under `convex/portfolio`, plus cron wiring that materializes those periods without duplicating rows on rerun.
- Publish chart-ready historical portfolio outputs for lender cockpit consumers so downstream UI does not recompute time-series data in React.
- Publish a server-generated CSV export contract for lender tax-software workflows with stable availability metadata, filename, CSV payload, generation timestamp, period label, and explicit completeness labeling.
- Add focused backend tests covering reruns, UTC-safe cutoff boundaries, current-period fallback, stable CSV rows, zero-position cases, and exited-position history.

## Constraints
- Snapshot boundaries must use the repo's strict UTC-safe `YYYY-MM-DD` business-date convention from `convex/lib/businessDates.ts`; month-end and year-end cutoffs are last-calendar-date boundaries in that system.
- Export logic stays server-side and CSV-first. This issue must not imply PDF generation, T5 issuance, or official tax-document generation.
- Historical completeness must be explicit in the returned contract. Downstream consumers must not infer snapshot completeness from missing fields or build CSV rows locally.
- Lender scoping must remain structural and portal-aware through the existing `convex/portfolio` query surface. No route-local recomputation or client-supplied identity shortcuts.
- `ENG-313` is the downstream UI consumer and expects upstream cockpit history plus the exact export fields `isAvailable`, `unavailableReason?`, `filename?`, `csv?`, `generatedAt`, `periodLabel`, and `dataCompleteness`.
- Historical data must remain correct for zero-position lenders, current-period fallback windows, and lenders who fully exited positions after the completed periods being exported.

## Open questions
- none
