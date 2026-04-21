# Spec Compliance Review

- Issue: https://linear.app/fairlend/issue/ENG-302/broker-portal-add-explicit-borrower-portal-attribution-on-onboarding
- Review target: current branch diff on `codex/eng-302-explicit-borrower-portal-attribution`
- Reviewed at: 2026-04-20 23:15:24 EDT

## Findings
- none. The ENG-302 contract is satisfied by the current branch diff based on code inspection, seed/fixture proof updates, and required repo gates.

## Verdict
- Verdict: ready

## Coverage Summary
- SATISFIED: 10
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 0

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | data model | `borrowers` and `onboardingRequests` carry explicit `portalId` attribution plus portal-scoped indexes | `convex/schema.ts` | adds `by_portal`, `by_portal_status`, and `by_portal_user` indexes |
| SATISFIED | backend behavior | portal-aware onboarding requests persist trusted portal attribution at write time | `convex/onboarding/mutations.ts`, `src/test/convex/onboarding/onboarding.test.ts` | server derives portal attribution from persisted `users.homePortalId` and only persists live published portals |
| SATISFIED | backend behavior | borrower provisioning persists portal attribution across canonical origination and direct helper paths | `convex/borrowers/resolveOrProvisionForOrigination.ts`, `convex/admin/origination/commit.ts`, `convex/admin/origination/collections.ts`, `convex/seed/seedBorrower.ts`, `src/test/convex/admin/origination/commit.test.ts` | live origination now pins borrower attribution to the current broker portal, unresolved portal state fails closed, and reused seed rows repair missing attribution |
| SATISFIED | persistence and synchronization | existing onboarding and borrower rows are backfilled deterministically and unresolved rows remain operator-visible | `convex/portals/borrowerPortalAttribution.ts`, `convex/brokers/migrations.ts`, `convex/portals/__tests__/registry.test.ts` | status query and mutation now report unresolved ids explicitly |
| SATISFIED | auth and access | borrower-derived home portal assignment prefers explicit borrower attribution while preserving safe legacy fallback | `convex/portals/homePortalAssignment.ts`, `convex/portals/__tests__/registry.test.ts` | onboarding attribution wins over legacy org fallback |
| SATISFIED | auth and access | portal borrower access keys off explicit borrower attribution rather than generic org matching | `convex/portals/middleware.ts`, `convex/portals/__tests__/middleware.test.ts` | middleware now requires `borrowers.portalId === context.portal.portalId` |
| SATISFIED | auth and access | wrong-portal borrower access is denied even when `borrower.orgId` still matches the requested portal | `convex/portals/__tests__/middleware.test.ts` | same-org mismatch fixture proves the explicit-portal deny path |
| SATISFIED | capability | the FairLend `app` portal stays inside the same explicit attribution contract as broker portals | `convex/brokers/migrations.ts`, `convex/portals/__tests__/registry.test.ts` | registry backfill and borrower home-portal assertions cover the FairLend portal path |
| SATISFIED | tests and fixtures | update seeds, fixtures, and direct test inserts so the explicit attribution schema is exercised consistently | `convex/seed/seedOnboardingRequest.ts`, `convex/seed/seedBorrower.ts`, `src/test/convex/seed/seedAll.test.ts`, `src/test/convex/engine/transition.test.ts`, `src/test/convex/engine/hash-chain-reconciliation.test.ts` | onboarding and borrower seeds now both repair missing `portalId` on rerun, and the remaining direct test inserts now supply explicit portal attribution |
| SATISFIED | tests and validation | required quality gates and targeted suites pass on the final tree | `bunx convex codegen`, `bun check`, `bun typecheck`, `bun run test -- src/test/convex/onboarding/onboarding.test.ts src/test/auth/integration/onboarding-auth.test.ts src/test/convex/admin/origination/commit.test.ts src/test/convex/seed/seedAll.test.ts` | `bun check` still reports pre-existing repo cognitive-complexity warnings outside ENG-302 scope |

## Open Questions
- none
