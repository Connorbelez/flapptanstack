# Execution Checklist: ENG-311 - Lender portfolio: ship command-center route, ledgers, and detail sheets

## Requirements From Linear
- [x] Add a single `/lender/portfolio` route under the existing lender boundary.
- [x] Own the shared portfolio route/query orchestration seam so downstream issues consume one route-level data boundary instead of inventing competing query modules.
- [x] Render the page in the approved order with named composition slots for cockpit, positions table, payment activity table, lower export-strip, suggested opportunities, and the sticky rail.
- [x] Keep positions as the first operational table.
- [x] Keep payment activity as individual-payment rows, not aggregated rollups.
- [x] Add filter and ordering controls to both table headers.
- [x] Clicking a position row opens a full-height right-side sheet host on desktop and a drawer on mobile.
- [x] Clicking a payment row opens a full-height right-side sheet host on desktop and a drawer on mobile.
- [x] Keep the sheet internals to a single stacked column and avoid nested card-heavy sidebars.
- [x] Ensure the desktop sheet overlay fully covers the page and sticky rail while open.
- [x] Reuse upstream contract fields instead of recalculating ownership or payment math locally.
- [x] Own the baseline `/lender/portfolio` route test so downstream issues can stay focused on leaf coverage.

## Definition Of Done From Linear
- [x] `/lender/portfolio` exists as a single command-center route.
- [x] Positions and payment activity are first-class ledgers on the page.
- [x] Row interactions use the approved full-height sheet / drawer pattern.
- [x] The route/query seam and baseline route test are owned in one place.
- [x] The UI does not regress into route-heavy or card-heavy portfolio UX.
- [x] Repo validation commands pass.
  - `bunx convex codegen` passed.
  - `bun check` passed.
  - `bun typecheck` passed.
  - `bun run test -- src/test/routes/lender-portfolio-route.test.tsx` passed.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit and route-integration tests cover the shared query seam, command-center shell ordering, filter/sort behavior, empty state handling, and row-to-sheet orchestration.
- [x] E2E coverage is added or explicitly justified after checking whether the existing Playwright auth/portal harness can exercise `/lender/portfolio` safely in this repo state.
  - Dedicated Playwright coverage is not practical yet because the current authenticated browser harness does not seed deterministic lender-portfolio data for this route.
- [x] Storybook coverage is added for the reusable lender portfolio surface states because this issue introduces net-new UI composition components.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] Required quality gates passed.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
