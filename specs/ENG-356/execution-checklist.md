# Execution Checklist: ENG-356 - MIC portal: implement ledger-derived portfolio query contracts

## Requirements From Linear
- [x] Resolve MIC portfolio scope from the active MIC portal's explicit canonical lender mapping, not from WorkOS org membership or lender id naming heuristics.
- [x] Export MIC-specific Convex queries through fluent-convex with explicit `.public()` visibility and permission/portal middleware.
- [x] Require a valid MIC portal host, active portal config, and `mic:access`; all missing or mismatched states must fail closed.
- [x] Derive totals, rows, concentration, and history from posted ledger position/payment records tied to the canonical MIC lender id.
- [x] Return the documented dashboard envelope with `generatedAt`, `sourceOfTruth`, `dataCompleteness`, and `warnings`.
- [x] Omit treasury, reserve, cash-on-hand, NAV, personalized holdings, unit ownership, and cap-table fields unless a later approved ledger contract supports them.
- [x] Preserve existing lender portfolio behavior and avoid changing shared high-impact helpers unless fresh GitNexus impact is run and accepted.
- [x] Cover happy path, empty positions, missing mapping, inactive portal, missing permission, non-MIC lender exclusion, and incomplete cash-ledger warning cases in tests.

## Definition Of Done From Linear
- [x] MIC portfolio query module and validators exist with typed contracts and no `any` shortcuts.
- [x] Dashboard, positions, position detail, payment history, and concentration query contracts are implemented or explicitly narrowed with matching tests.
- [x] Query output is proven to come from ledger position participation for the configured MIC lender.
- [x] Missing or invalid portal/lender/permission state fails closed.
- [x] Unsupported cash and personalized investor metrics are absent from query responses.
- [x] Existing lender portfolio tests still pass.
- [x] `bunx convex codegen`, `bun check`, and `bun typecheck` pass.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated where backend or domain logic changed.
- [x] E2E tests added or updated where an operator or user workflow changed.
  - Not applicable: ENG-356 is backend query-contract work with no operator/user workflow UI.
- [x] Storybook stories added or updated where reusable UI changed.
  - Not applicable: ENG-356 adds Convex backend contracts only and no reusable UI components.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] Required quality gates passed.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
