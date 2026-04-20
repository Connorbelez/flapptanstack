# Spec Compliance Review

- Audit skill: `$linear-pr-spec-audit`
- Review target: `eng-297..HEAD` (`3fde40e4153181420368c14130e73e9341171894..4ae70928395ec46369665fa017d3a59f687d93dd`)
- Last run: `2026-04-20T22:33:22Z`

## Findings
- None remaining. The follow-up patch moved the broker-split and policy-window guards into shared validators, added the missing unhappy-path pricing coverage, proved the FairLend `app` portal uses the same contract, and reran the closeout commands successfully.

## Verdict
- ready

## Coverage Summary
- SATISFIED: 10
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 0

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
| --- | --- | --- | --- | --- |
| SATISFIED | data model | Reuse the existing `portalPricingPolicies` table and `portals.pricingPolicyId` seam instead of adding a second pricing store | `convex/schema.ts`, `convex/portals/pricing.ts` | the branch keeps the `ENG-297` seam and builds selection logic on top of it |
| SATISFIED | lifecycle | Add the minimum lifecycle fields and deterministic selection rules needed to choose one active policy | `convex/schema.ts`, `convex/portals/pricing.ts` | `status`, `effectiveFrom`, `effectiveTo`, overlap detection, and canonical-pointer handling are implemented |
| SATISFIED | validation | Reject malformed policy parameters and invalid policy windows through the shared pricing contract helpers | `convex/portals/validators.ts`, `convex/portals/pricing.ts`, `convex/portals/__tests__/pricing.test.ts` | `validatePortalPricingPolicyParameters()` and `validatePortalPricingPolicyContract()` now own the contract checks and are covered directly |
| SATISFIED | shared math | Implement one reusable portal-pricing helper and one rounding rule | `convex/portals/pricing.ts`, `convex/listings/math.ts`, `convex/listings/queries.ts`, `convex/listings/projection.ts` | pricing math is centralized and the duplicate rounders were collapsed into one helper |
| SATISFIED | projection boundary | Keep portal pricing as a read-time projection over canonical listing inventory and limit v1 adjustments to portal-facing return fields | `convex/portals/pricing.ts`, `convex/listings/__tests__/queries.test.ts`, `src/components/lender/listings/LenderListingDetailPage.tsx` | only `interestRate` and `monthlyPayment` are projected; principal, LTV, lien position, and maturity stay canonical |
| SATISFIED | fail-closed behavior | Published portals fail explicitly when pricing is missing or invalid, while unpublished portals may stay setup-safe | `convex/portals/pricing.ts`, `convex/portals/__tests__/pricing.test.ts` | coverage now includes missing-active-policy and invalid-selected-policy cases |
| SATISFIED | default portal rule | Treat the FairLend `app` portal as a first-class consumer of the same pricing contract | `convex/portals/__tests__/pricing.test.ts`, `convex/portals/helpers.ts`, `shared/portal/contracts.ts` | the new fixture test proves `app.fairlend.ca` / `app.localhost` consumes the same selection helper |
| SATISFIED | scope boundary | Keep per-lender pricing out of scope and avoid broad `ENG-301` route/query rollout | `convex/portals/pricing.ts`, `convex/listings/__tests__/queries.test.ts` | the branch adds an importable helper plus a thin listing-fixture seam, not portal-aware listing queries |
| SATISFIED | tests | Add focused tests for validator rules, selection rules, projection math, and fail-closed behavior | `convex/portals/__tests__/pricing.test.ts`, `convex/listings/__tests__/queries.test.ts` | the targeted run now covers validator errors, invalid windows, missing policies, invalid selected policies, projection math, DB loading, and listing-fixture integration |
| SATISFIED | quality gates | `bunx convex codegen`, `bun check`, `bun typecheck`, targeted tests, and `coderabbit review --plain` pass | local command evidence | `bun check` exits 0 with pre-existing repo-wide complexity warnings outside the `ENG-300` diff; the scoped CodeRabbit review completed with no findings |

## Validation Evidence
- `bun run test -- convex/portals/__tests__/pricing.test.ts convex/listings/__tests__/queries.test.ts`: passed (`19` tests across `2` files; Vitest reported a post-run close timeout after success)
- `bun typecheck`: passed
- `CONVEX_DEPLOYMENT=dev:impartial-sturgeon-498 bunx convex codegen`: passed
- `bun check`: passed (`biome check . --write`; repo-wide complexity warnings remain outside this diff)
- `coderabbit review --plain --base-commit 3fde40e4153181420368c14130e73e9341171894 --type committed`: completed with no findings
