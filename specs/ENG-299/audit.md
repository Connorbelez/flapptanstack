# Spec Audit: ENG-299 - Broker portal: enforce portal membership in Convex middleware

- Audit skill: `$linear-pr-spec-audit`
- Review target: current working tree on `connorbelez/eng-299-broker-portal-enforce-portal-membership-in-convex-middleware` against the `origin/eng-297` contract
- Last run: 2026-04-20T17:15:05-0400
- Verdict: ready

## Findings
- No material `MISSING`, `CONTRADICTED`, or `PARTIAL` gaps were found against the Linear issue contract. The middleware, builder, proof, and test evidence align with the stated requirements.

## Unresolved items
- none

## Coverage Summary
- SATISFIED: 10
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 0

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
| --- | --- | --- | --- | --- |
| SATISFIED | backend behavior | Reload canonical portal state from a trusted portal identifier and reject unavailable portals before handler logic | `convex/portals/middleware.ts:102-125` | `loadPortalOrThrow` fails closed for missing, inactive, or unpublished portals before returning typed portal context. |
| SATISFIED | auth | Same-portal membership is keyed off `users.homePortalId` with FairLend admin override only | `convex/portals/middleware.ts:127-143` | No alternate bypass path exists beyond `viewer.isFairLendAdmin`; cross-portal non-admin calls throw `Forbidden: wrong portal`. |
| SATISFIED | auth | Borrower and lender portal checks reuse shared actor-resolution helpers | `convex/auth/actorResolution.ts:8-95`, `convex/portals/middleware.ts:145-170` | Borrower access resolves against borrower `orgId`; lender access resolves against portal `brokerId` with `orgId` fallback. |
| SATISFIED | architecture | Portal membership remains structural and outside `resourceChecks` | `convex/portals/middleware.ts:173-288`, `convex/portals/proof.ts:24-73`, `convex/auth/resourceChecks.ts:1-10` | Resource checks now import the shared actor helpers but do not absorb portal membership logic. |
| SATISFIED | builder surface | Expose portal-aware fluent-convex builder chains instead of standalone endpoint helpers | `convex/fluent.ts:445-492` | Public, authenticated, borrower, lender, and mutation variants all compose `portalId` into the input contract. |
| SATISFIED | capability | Add a thin proof consumer before broader portal adoption | `convex/portals/proof.ts:18-73` | Proof queries exercise public, authenticated, borrower, and lender portal seams without broad product rewrites. |
| SATISFIED | same-portal behavior | Same-portal non-admin access succeeds through reusable portal builders | `convex/portals/__tests__/middleware.test.ts:286-301` | Broker proof path returns `same-portal` and preserves derived filter/pricing context. |
| SATISFIED | negative contract | Cross-portal non-admin access is denied before resource-level checks can grant access | `convex/portals/__tests__/middleware.test.ts:303-315` | Test asserts denial on portal mismatch before resource access proof can succeed. |
| SATISFIED | override behavior | FairLend admin cross-portal access works only through explicit override | `convex/portals/__tests__/middleware.test.ts:317-330` | Proof path returns `admin-override` only for FairLend admin identity. |
| SATISFIED | validation | Codegen, lint/check, typecheck, and targeted tests pass | `bunx convex codegen`, `bun check`, `bun typecheck`, `bun run test -- convex/portals/__tests__/middleware.test.ts convex/auth/__tests__/resourceChecks.test.ts` | `bun check` still reports pre-existing complexity warnings elsewhere in the repo, but exits successfully after applying safe fixes. |

## Open Questions
- CodeRabbit full-branch review is blocked by the stacked branch size cap (`393` files > `300` limit). A narrower `--type uncommitted` review was attempted afterward, but no review findings were emitted before the local closeout continued.
- The installed GitNexus CLI does not expose `detect_changes`; scope validation used the earlier impact analysis plus `git status --short` and the working-tree diff as the closest available replacement.
