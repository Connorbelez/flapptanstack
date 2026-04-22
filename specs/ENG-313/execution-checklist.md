# Execution Checklist: ENG-313 - Lender portfolio: ship cockpit charts and CSV tax export surfaces

## Requirements From Linear
- [x] Render the financial cockpit at the top of `/lender/portfolio`, not on a separate route.
- [x] Show KPI cards for YTD, monthly, lifetime, and risk/renewal summary.
- [x] Render profit/projection charts and portfolio breakdown visuals using upstream contracts.
- [x] Keep chart loading/empty/error states layout-safe.
- [x] Render broker-imposed limits and CSV export together in the lower strip above suggested opportunities.
- [x] CSV export must use the server-generated contract from `ENG-310` and disable with a clear reason when unavailable.
- [x] Use the existing browser download helper pattern instead of generating CSV rows in React.
- [x] Do not imply PDF generation or official tax-document issuance in the UI copy.
- [x] Keep this issue scoped to leaf components and focused tests rather than route-host ownership.

## Definition Of Done From Linear
- [x] Cockpit visuals render at the top of the command center.
- [x] Broker limits + CSV export render in the lower strip.
- [x] The export flow consumes the pinned server-generated CSV contract directly.
- [x] No separate performance/tax route assumptions remain.
- [x] Repo validation commands pass.
  - `bun check`, `bunx convex codegen`, and `bun typecheck` all pass on the final diff. `bun check` still surfaces unrelated pre-existing complexity warnings in untouched Convex modules, but the validation gate is green.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated for cockpit and export-strip rendering, disabled export, empty chart states, and completeness labeling.
- [x] E2E coverage is added or explicitly justified after confirming whether the existing authenticated lender-portal harness can exercise `/lender/portfolio` with deterministic portfolio data.
  - Dedicated Playwright coverage is not practical yet because the current `e2e` harness authenticates browser storage but does not provision deterministic lender-portfolio data for `/lender/portfolio`.
- [x] Storybook coverage is added or updated for the reusable lender portfolio surface states affected by the cockpit and export-strip leaf components.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] Required quality gates passed.
  - `bun check`, `bunx convex codegen`, `bun typecheck`, and the focused portfolio/backend tests all passed after the projection-contract fix.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
  - The rerun audit is `ready` with no remaining ENG-313 findings.
