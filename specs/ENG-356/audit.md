# Spec Audit: ENG-356 - MIC portal: implement ledger-derived portfolio query contracts

- Audit skill: `$linear-pr-spec-audit`
- Review target: local branch diff for ENG-356
- Last run: 2026-04-25T21:25:31-04:00
- Verdict: ready

## Findings
- none

## Unresolved items
- none

## Next action
- Ready for PR/commit after human review.

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | capability | Add MIC-specific dashboard, positions, position detail, payments history, and concentration queries. | `convex/micPortfolio/queries.ts` exports all five required public queries. | Uses fluent builders with explicit `.public()`. |
| SATISFIED | contracts | Return `generatedAt`, `sourceOfTruth`, `dataCompleteness`, and `warnings`. | `convex/micPortfolio/contracts.ts` and `buildEnvelope` in `queries.ts`. | `sourceOfTruth` is the required `mortgage_ledger_lender_participation` literal. |
| SATISFIED | auth | Require active MIC portal mapping and `mic:access`, failing closed for invalid state. | `resolveMicPortalConfig`, `getLenderByAuthId`, and `requirePermission("mic:access")` in `queries.ts`; failure tests in `queries.test.ts`. | Missing mapping, inactive portal, missing permission, and unresolved lender are covered. |
| SATISFIED | data source | Derive positions from posted active ledger position accounts for the canonical MIC lender. | `listMicPositionAccounts` queries `ledger_accounts.by_lender` using `portal.micLenderAuthId`, filters `POSITION` and positive posted balance. | No WorkOS org membership or lender-name regex matching. |
| SATISFIED | negative contract | Do not expose treasury, reserve, cash-on-hand, NAV, cap-table, unit ownership, or personalized holdings. | Contract validators expose only portfolio ledger participation fields; tests assert unsupported keys are absent. | Cash-ledger incompleteness is represented as a warning and `partial` completeness. |
| SATISFIED | regression safety | Preserve existing lender portfolio behavior. | Existing lender portfolio tests pass alongside MIC tests. | Shared high-impact lender helper was not modified. |
| SATISFIED | tests | Cover happy path, empty positions, missing mapping, inactive portal, missing permission, non-MIC exclusion, incomplete cash warning. | `convex/micPortfolio/__tests__/queries.test.ts`. | Relevant suite passes. |

## Validation Evidence
- `bunx convex codegen`: passed
- `bun check`: passed with existing warnings
- `bun run typecheck`: passed
- `bun run test convex/micPortfolio/__tests__/queries.test.ts convex/portfolio/__tests__/queries.test.ts`: passed, 13 tests
- Full `bun run test`: attempted; unrelated `convex/demo/__tests__/ampsE2e.test.ts` failures remain outside ENG-356.
- Final artifact validation: passed
- GitNexus change detection: `npx gitnexus detect_changes` unavailable in this CLI; `npx gitnexus status` and `git status --short` fallback reviewed expected scope.
