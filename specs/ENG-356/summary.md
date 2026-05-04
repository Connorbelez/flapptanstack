# Summary: ENG-356 - MIC portal: implement ledger-derived portfolio query contracts

- Source issue: https://linear.app/fairlend/issue/ENG-356/mic-portal-implement-ledger-derived-portfolio-query-contracts
- Primary plan: https://www.notion.so/34efc1b440248154a49ff611bed57d2d
- Supporting docs:
  - ENG-352 portal/RBAC/mapping contract dependency
  - https://www.notion.so/2c4fc1b44024802ca426d1e8d61138ee

## Scope
- Create a dedicated `convex/micPortfolio/*` backend surface for read-only MIC investor portfolio query contracts.
- Resolve MIC scope from `portals.micLenderAuthId` through the active MIC portal config, then read posted active position accounts from `ledger_accounts.lenderId`.
- Export fluent-convex public queries:
  - `getMicDashboardSnapshot({ portalId })`
  - `getMicPositions({ portalId, filters? })`
  - `getMicPositionDetail({ portalId, mortgageId })`
  - `getMicPaymentsHistory({ portalId, mortgageId? })`
  - `getMicConcentrationExposure({ portalId })`
- Return contract envelopes with `generatedAt`, `sourceOfTruth: "mortgage_ledger_lender_participation"`, `dataCompleteness`, and `warnings`.
- Add convex-test/Vitest coverage for happy path, empty positions, missing mapping, inactive/unpublished portal, missing `mic:access`, non-MIC lender exclusion, and incomplete cash-ledger warning behavior.

## Constraints
- Use `fluent-convex`; exported Convex queries must end in explicit `.public()`.
- Authorization must fail closed through authenticated caller plus `mic:access` and active MIC portal config.
- Do not modify `listActiveLenderPositionAccounts`; Linear records it as HIGH impact and the Notion plan says to reuse/add a MIC-specific layer instead.
- Do not modify `PortalBuilder`; Linear records it as CRITICAL impact.
- Do not include treasury, reserves, cash-on-hand, NAV, cap table, unit ownership, personalized holdings, or distribution accounting fields.
- Existing lender portfolio behavior must remain intact.

## Open questions
- none
