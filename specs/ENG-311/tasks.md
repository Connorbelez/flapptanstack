# Tasks: ENG-311 - Lender portfolio: ship command-center route, ledgers, and detail sheets

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Finalize the implementation task list, chunk plan, and execution artifacts for the approved route/shell/detail-host scope.

## Phase 2: Route And Query Seam
- [x] T-010: Add lender portfolio route-facing search and detail state types in `src/components/lender/portfolio/portfolio-types.ts`.
- [x] T-011: Add search parser / cleaner helpers for the route-owned filters, sorts, and detail selection state in `src/components/lender/portfolio/search.ts`.
- [x] T-012: Add shared React query-option helpers for the command-center, position detail, and payment detail reads in `src/components/lender/portfolio/query-options.ts`.
- [x] T-013: Add `src/routes/lender.portfolio.tsx` with portal-aware loader prefetching, validated search state, suspense-safe auth gating, and a route-level error surface.

## Phase 3: Shell And Ledgers
- [x] T-020: Add shared formatters and slot-host primitives in `src/components/lender/portfolio/portfolio-formatters.ts` and `src/components/lender/portfolio/portfolio-shell.tsx`.
- [x] T-021: Add `src/components/lender/portfolio/LenderPortfolioPage.tsx` to compose the approved section order, named slot hosts, and command-center empty / loading / error states.
- [x] T-022: Add `src/components/lender/portfolio/positions-table.tsx` with header filter / sort controls, position-row rendering, and row selection callbacks.
- [x] T-023: Add `src/components/lender/portfolio/payment-activity-table.tsx` with header filter / sort controls, individual payment rows, and row selection callbacks.

## Phase 4: Detail Hosts
- [x] T-030: Add a responsive portfolio detail host wrapper that switches between desktop sheet and mobile drawer without editing shared UI primitives unless GitNexus analysis proves that change is necessary.
- [x] T-031: Add `src/components/lender/portfolio/position-sheet.tsx` using the portfolio position-detail contract and the approved single-column layout hierarchy.
- [x] T-032: Add `src/components/lender/portfolio/payment-sheet.tsx` using the portfolio payment-detail contract and the approved single-column layout hierarchy.
- [x] T-033: Wire route-owned row-to-sheet orchestration so only one portfolio detail host is active from search state at a time.

## Phase 5: Tests And Stories
- [x] T-040: Add baseline `/lender/portfolio` route coverage in `src/test/routes/lender-portfolio-route.test.tsx` for loader/query seam usage, shell ordering, empty-state behavior, filter/sort state, and row-to-sheet orchestration.
- [x] T-041: Add Storybook coverage for the reusable lender portfolio surface states in `src/components/lender/portfolio/LenderPortfolioPage.stories.tsx`.
- [x] T-042: Decide whether dedicated Playwright coverage is practical in the current auth/portal harness and record the outcome in the execution artifacts.
- [x] T-043: Extend the payment activity route search seam and ledger UI to support the approved due-date range filter.
- [x] T-044: Add explicit `/lender/portfolio` unauthorized-access coverage alongside the existing route seam tests.
- [x] T-045: Resolve the current `bun check` blockers so the repo validation gate passes cleanly again.

## Phase 6: Validation
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-905: Re-run the focused `/lender/portfolio` Vitest suite after the audit-fix pass.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted Vitest coverage for `src/test/routes/lender-portfolio-route.test.tsx`.
- [x] T-904: Run the relevant broader tests, including `bun run test:e2e` if the finished route behavior is practical to exercise through the existing Playwright auth harness.
  - Result: dedicated Playwright coverage is not practical in the current repo state because the authenticated browser harness does not seed deterministic lender-portfolio data for `/lender/portfolio`.

## Phase 9: Audit
- [x] T-910: Run `$linear-pr-spec-audit` against the current branch diff for `ENG-311`.
- [x] T-920: Resolve audit findings or record blockers, then rerun the audit if the spec gate is not yet ready.
