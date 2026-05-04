# Tasks: ENG-357 - MIC portal: wire landing page and read-only dashboard UI

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Public Landing Page
- [x] T-001: Add `src/components/mic/MicLandingPage.tsx` with email request form, generic success state, and WorkOS sign-in CTA preserving MIC context.
- [x] T-002: Wire `src/routes/index.tsx` to render `MicLandingPage` when `portalContext.portal.portalType === "mic"` instead of generic portal home.
- [x] T-003: Connect email form to `api.micInvestorAccessRequests.submitPublicRequest` Convex mutation with loading/error states and generic success for duplicates.

## Phase 2: Route Structure and Query Integration
- [x] T-010: Create `src/components/mic/query-options.ts` with `micDashboardSnapshotQueryOptions`, `micPositionsQueryOptions`, `micPositionDetailQueryOptions` using `convexQuery`.
- [x] T-011: Refactor `src/routes/portal.tsx` into a layout route with `Outlet` (follow `src/routes/listings/route.tsx` pattern) keeping the `Authenticated`/`AuthLoading` boundary.
- [x] T-012: Create `src/routes/portal/index.tsx` dashboard route with `loader` calling `ensureQueryData(micDashboardSnapshotQueryOptions(...))` and `useSuspenseQuery` in component.
- [x] T-013: Create `src/routes/portal/positions.$mortgageId.tsx` child route for position detail with loader + suspense query.

## Phase 3: Dashboard Components — Metrics and Positions
- [x] T-020: Add `src/components/mic/MicDashboardMetrics.tsx` rendering `MicPortfolioMetrics` (outstanding principal, active positions, weighted avg yield/LTV, arrears/delinquency exposure).
- [x] T-021: Add `src/components/mic/MicPositionsTable.tsx` rendering `MicPositionRow[]` with sortable columns, search/filter UI, and row-click handler for drilldown.
- [x] T-022: Add `src/components/mic/MicPositionDetailDrawer.tsx` using `getMicPositionDetail` / `getMicPaymentsHistory` queries to show mortgage terms, property info, and payment history in a sheet/drawer.
- [x] T-023: Add `src/components/mic/MicDataWarnings.tsx` banner surfacing `dataCompleteness` and `warnings` from the MIC portfolio envelope without inventing metrics.

## Phase 4: Dashboard Components — Concentration and Maturity
- [x] T-030: Add `src/components/mic/MicConcentrationSection.tsx` rendering `MicConcentrationExposureData` breakdowns (borrower, geography, property type, status).
- [x] T-031: Add `src/components/mic/MicMaturityLadder.tsx` rendering `MicMaturityLadderBucket[]` with counts and outstanding principal per bucket.
- [x] T-032: Wire "View full mortgage detail" CTA from position rows using `drilldownIds.listingId` when present; hide CTA when `listingId` is null.
- [x] T-033: Ensure all dashboard components handle empty-state gracefully (no positions, no payments, etc.).

## Phase 5: Tests and Validation
- [ ] T-040: Add `src/test/mic/landing-page.test.tsx` testing email form submission, generic success state, duplicate handling, and sign-in CTA href.
- [ ] T-041: Add `src/test/mic/dashboard.test.tsx` testing metrics rendering, position table row click, drawer open, warnings banner, and empty states.
- [ ] T-042: Add `src/test/mic/portal-routes.test.tsx` testing `/portal` loader behavior, `/portal/positions/$mortgageId` route, and auth boundary.
- [ ] T-900: Run `bunx convex codegen`.
- [ ] T-901: Run `bun check`.
- [ ] T-902: Run `bun typecheck`.
- [ ] T-903: Run relevant unit test suite (`bun run test`).
- [ ] T-910: Run `gitnexus_detect_changes()` to verify scope.
