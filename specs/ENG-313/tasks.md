# Tasks: ENG-313 - Lender portfolio: ship cockpit charts and CSV tax export surfaces

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Finalize the ENG-313 execution artifacts, chunk plan, and validation targets using the approved Linear and Notion contracts.

## Phase 2: Cockpit Surface
- [x] T-010: Add `src/components/lender/portfolio/portfolio-cockpit.tsx` to render the top-of-page KPI cards, historical trend charts, and portfolio breakdown visuals from the existing command-center and history contracts.
- [x] T-011: Add or extend portfolio-specific presentation helpers in `src/components/lender/portfolio/portfolio-formatters.ts` so cockpit copy, currency, completeness, and chart labels stay leaf-local and deterministic.
- [x] T-012: Replace the ENG-311 cockpit placeholder in `src/components/lender/portfolio/LenderPortfolioPage.tsx` with the new cockpit leaf component while preserving route-host ownership boundaries.

## Phase 3: Export Strip Surface
- [x] T-020: Add `src/components/lender/portfolio/portfolio-export-strip.tsx` to render broker-imposed limits, export status messaging, and the CSV-first export action from the server-generated ENG-310 contract.
- [x] T-021: Wire the export-strip leaf into `src/components/lender/portfolio/LenderPortfolioPage.tsx` in the approved placement above suggested opportunities without changing route ownership.
- [x] T-022: Reuse the browser CSV download helper pattern from `src/components/admin/financial-ledger/csv.ts`, extracting only the smallest additive helper changes if the current surface needs them.

## Phase 4: Tests And Stories
- [x] T-030: Update or extend `src/components/lender/portfolio/fixtures.ts` and `src/components/lender/portfolio/LenderPortfolioPage.stories.tsx` to cover the cockpit and export-strip states, including disabled export and empty-history scenarios.
- [x] T-031: Add focused component coverage in `src/test/lender/portfolio-cockpit.test.tsx` for cockpit rendering, chart-state fallbacks, export availability messaging, and CSV download behavior.
- [x] T-032: Decide whether dedicated Playwright coverage is practical for `/lender/portfolio` in the current authenticated harness and record the outcome in the execution artifacts.
  - No dedicated Playwright scenario was added because the current `e2e` setup provisions auth storage only and does not seed deterministic lender-portfolio data for `/lender/portfolio`; focused route/component tests plus backend export-contract coverage close the ENG-313 acceptance slice safely.

## Phase 5: Validation
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
  - `bun check` passes on the final diff after fixing the cockpit Biome error; it still reports unrelated pre-existing complexity warnings in untouched Convex files.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted tests for the touched scope, including `bun run test -- src/test/lender/portfolio-cockpit.test.tsx convex/portfolio/__tests__/export.test.ts`.
  - Final targeted validation also included `src/test/routes/lender-portfolio-route.test.tsx` and `convex/portfolio/__tests__/snapshots.test.ts` so the new projection contract and route seam are both covered.
- [x] T-904: Run the relevant broader tests or record why additional E2E coverage is not practical in the current repo state.
  - Broader validation covered `src/test/routes/lender-portfolio-route.test.tsx` plus `convex/portfolio/__tests__/export.test.ts`; dedicated Playwright coverage remains unjustified for this slice until the authenticated harness can provision deterministic lender-portfolio data.

## Phase 9: Audit
- [x] T-910: Run `$linear-pr-spec-audit` against the current branch diff for `ENG-313`.
- [x] T-920: Resolve audit findings or record blockers, then rerun the audit if the spec gate is not yet ready.
  - The projection chart gap and validation-gate concern were both resolved, and the rerun audit closes as `ready`.
