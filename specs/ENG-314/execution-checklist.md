# Execution Checklist: ENG-314 - Lender portfolio: ship bottom-of-page suggested opportunities

## Requirements From Linear
- [x] Keep Suggested opportunities at the bottom of `/lender/portfolio`.
- [x] Consume ordered server DTOs from `ENG-308`; do not rank or score listings in React.
- [x] Respect broker-imposed constraints and already-owned exclusions exactly as produced by the server contract.
- [x] Show explanation tags or reasons for why each opportunity fits.
- [x] Deep-link into existing lender listing detail instead of creating a parallel drill-down surface.
- [x] Render clean loading, empty, unavailable, and stale-data states without collapsing the page.
- [x] Leave route-shell ownership, shared query seams, and the baseline `/lender/portfolio` route test to `ENG-311`.

## Definition Of Done From Linear
- [x] Suggested opportunities render at the bottom of the command center.
- [x] Each opportunity explains why it fits.
- [x] Existing lender listing/detail patterns are reused for drill-down.
- [x] Client-side ranking is absent; the section consumes ordered server DTOs.
- [x] Focused tests and repo validation commands pass.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Add or update focused UI coverage for the suggested opportunities consumer in `src/test/lender/portfolio-suggested-opportunities.test.tsx`.
- [x] Re-run backend suggestion-contract coverage through the existing `convex/portfolio/__tests__/queries.test.ts` suite, which currently houses the already-owned exclusion and broker-constraint cases referenced by the issue.
- [x] Assess dedicated Playwright coverage and record whether it is practical for this leaf consumer slice, which reuses existing authenticated listing/detail flows and does not own the route/auth harness.
  Recorded outcome: dedicated Playwright coverage is not practical in the current auth/seed harness for this leaf slice.
- [x] Add or update Storybook coverage for the suggested opportunities component states.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] Required quality gates passed.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
