# Execution Status: ENG-313 - Lender portfolio: ship cockpit charts and CSV tax export surfaces

- Overall status: complete
- Current phase: complete
- Current chunk: none
- Last updated: 2026-04-22T21:40:08Z

## Active focus
- ENG-313 is closed out: the cockpit now renders the required projected aggregate earnings trend, the export strip remains wired to the server CSV contract, and the final audit is `ready`.

## Blockers
- none

## Notes
- ENG-311 already shipped the `/lender/portfolio` route, layout order, slot-host placeholders, and baseline route coverage; ENG-313 should stay inside the leaf cockpit/export slice.
- ENG-310 already shipped the historical-series and tax-export backend contracts, including completeness metadata and the exact CSV export field names expected by the plan.
- `LenderPortfolioPage` now renders a connected `PortfolioCockpit` at the top of the page and a connected `PortfolioExportStrip` above suggested opportunities while preserving the existing route shell and detail-host ownership.
- The upstream portfolio snapshot and historical-series contracts now include `projectedAggregateEarnings`, computed from snapshot balance through mortgage maturity so the UI can render the approved projection surface without doing financial math in React.
- `python3 /Users/connor/.codex/skills/linear-implement-v2/scripts/validate_execution_artifacts.py ENG-313 --repo-root "/Users/connor/.codex/worktrees/2c44/fairlendapp" --stage ready-to-edit` passed.
- GitNexus impact for `LenderPortfolioPage` is `LOW` risk with `0` direct upstream callers and `0` affected execution flows after refreshing the index for this worktree.
- GitNexus `detect_changes(scope=\"all\")` reports `16` changed symbols, `3` affected intra-community processes rooted at `LenderPortfolioPage`, and an overall `medium` review risk that matches the expected command-center integration seam.
- `bun check` passed on the final diff; Biome still reports existing complexity warnings in unrelated untouched Convex modules, but they are non-blocking warnings rather than a failing validation gate.
- `bunx convex codegen` passed on the final diff.
- `bun typecheck` passed on the final diff.
- `bun run test -- src/test/lender/portfolio-cockpit.test.tsx src/test/routes/lender-portfolio-route.test.tsx convex/portfolio/__tests__/export.test.ts convex/portfolio/__tests__/snapshots.test.ts` passed with `21` tests; the earlier Recharts `ResponsiveContainer` jsdom warnings were eliminated with deterministic `ResizeObserver` sizing shims.
- `python3 /Users/connor/.codex/skills/linear-implement-v2/scripts/validate_execution_artifacts.py ENG-313 --repo-root "/Users/connor/.codex/worktrees/2c44/fairlendapp" --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed` passed.
- No dedicated Playwright coverage was added because the current `e2e` harness authenticates storage state but does not provision deterministic lender-portfolio data for `/lender/portfolio`.
