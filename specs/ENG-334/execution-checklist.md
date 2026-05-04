# Execution Checklist: ENG-334 - Velocity package: deliver final review and activation UI wiring

## Requirements From Linear
- [x] Render the exact activation-preview data the backend activation path will consume.
- [x] Disable activation and retry actions when the backend reports blockers, stale review data, or in-flight activation state.
- [x] Render remediation state and retry affordances for failed activation attempts without fabricating local rules.
- [x] Use structural auth/route protection and the repo's authenticated suspense pattern when relevant.
- [x] Keep final review, activation, and remediation UI inside the Velocity admin workspace rather than inventing a second detached flow.
- [x] Show provenance identifiers and review-drift messaging clearly enough for operators to understand why activation is or is not allowed.

## Definition Of Done From Linear
- [x] The final review screen exists and renders the backend activation preview coherently.
- [x] Activate and retry affordances are wired to backend contracts and do not reimplement readiness locally.
- [x] Stale-review and remediation states are visible and understandable to operators.
- [x] Route protection and pending/error states follow established admin patterns.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit/component tests added for final review rendering, action disabled states, stale review drift, and failed activation remediation/retry UI.
- [x] E2E tests added or updated where an operator workflow changed, or explicitly justified if local route/component coverage is sufficient for this slice.
- [x] Storybook stories added or updated where reusable UI changed, or explicitly justified if no reusable UI component was introduced.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] Required quality gates passed: `bun check`, `bun typecheck`, `bunx convex codegen`, targeted tests.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
