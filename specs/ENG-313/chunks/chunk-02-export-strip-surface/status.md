# Status: chunk-02-export-strip-surface

- Result: complete, superseded by final validation
- Last updated: 2026-04-22T21:03:47Z

## Completed tasks
- T-020
- T-021
- T-022

## Validation
- `bun run test -- src/test/lender/portfolio-cockpit.test.tsx`: passed
- `convex/portfolio/__tests__/export.test.ts`: passed
- `bun check`: failed for unrelated repo-wide Biome complexity diagnostics outside the export-strip slice
- `bun typecheck`: passed

This chunk snapshot is superseded by `specs/ENG-313/status.md` and `specs/ENG-313/audit.md`, where the final closeout records passing `bun check`, `bun typecheck`, and `bunx convex codegen` gates for the completed ENG-313 slice.

## Notes
- `PortfolioExportStrip` now renders broker-imposed limits, permission-aware export messaging, unavailable reasons, and the shared `downloadCsv` browser helper flow above suggested opportunities.
