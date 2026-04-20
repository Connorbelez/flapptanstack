# Spec Audit: ENG-299 - Broker portal: enforce portal membership in Convex middleware

- Audit skill: `$linear-pr-spec-audit`
- Review target: current working tree on `connorbelez/eng-299-broker-portal-enforce-portal-membership-in-convex-middleware` against the `origin/eng-297` contract
- Last run: 2026-04-20T19:26:25-0400
- Verdict: ready

## Findings
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
| SATISFIED | backend behavior | Reload canonical portal state from a trusted portal identifier and reject unavailable portals before handler logic | `convex/portals/middleware.ts:102-125`, `convex/portals/__tests__/middleware.test.ts:350-365` | Missing, suspended, and unpublished portals fail closed before proof handlers can run. |
| SATISFIED | auth | Same-portal membership is keyed off `users.homePortalId` with FairLend admin override only | `convex/portals/middleware.ts:127-143`, `convex/portals/__tests__/middleware.test.ts:367-410` | The access stage returns `same-portal` or `admin-override` and denies cross-portal non-admin viewers. |
| SATISFIED | shared logic | Portal middleware and resource checks reuse the same actor-resolution helpers without moving portal membership into `resourceChecks` | `convex/auth/actorResolution.ts:8-95`, `convex/auth/resourceChecks.ts:6-10`, `convex/auth/resourceChecks.ts:85-149` | Shared identity resolution is centralized while resource helpers remain resource-scoped booleans. |
| SATISFIED | builder surface | Expose structural portal-aware fluent-convex builders rather than standalone endpoint helpers | `convex/fluent.ts:347-497`, `convex/fluent.ts:641-785` | `PortalBuilder` wraps handler execution with portal middleware and preserves typed chain composition for public, authed, borrower, and lender flows. |
| SATISFIED | proof adoption | Add a thin proof consumer that exercises builder-injected portal context | `convex/portals/proof.ts:14-58`, `convex/portals/__tests__/middleware.test.ts:323-333` | Proof handlers consume `ctx.portal`, `ctx.portalAccess`, `ctx.borrower`, and `ctx.lender` directly; the test suite asserts they no longer manually call `loadPortalContext` or `resolvePortal*`. |
| SATISFIED | lender access | Resolve lender ownership against the current portal broker relationship rather than generic org equality | `convex/portals/middleware.ts:173-185`, `convex/portals/__tests__/middleware.test.ts:456-490` | Same-org lenders with the wrong broker relationship now fail closed. |
| SATISFIED | borrower access | Resolve borrower ownership against the current portal using the approved deterministic `borrowers.orgId -> portals.by_org -> portalId` mapping, with explicit first-class `portalId` fields deferred to `ENG-302` | `convex/portals/middleware.ts:145-170`, `convex/portals/__tests__/middleware.test.ts:413-454` | Borrowers with missing, unmapped, or ambiguous org attribution fail closed. The live Linear issue and Notion plan were re-verified on 2026-04-20 and both explicitly defer first-class borrower/onboarding `portalId` fields to `ENG-302`. |
| SATISFIED | negative contract | Keep portal membership structural and ahead of resource-level access helpers | `convex/portals/middleware.ts:206-259`, `convex/portals/proof.ts:20-35`, `convex/auth/resourceChecks.ts:98-149` | The portal proof query composes portal access first and only then invokes `canAccessMortgage`, preserving the boundary between host-level membership and resource-level authorization. |
| SATISFIED | typed context | Preserve typed portal context so downstream handlers receive `ctx.portal` and actor-specific entities without `any` | `convex/fluent.ts:347-497`, `convex/fluent.ts:641-785`, `convex/portals/proof.ts:14-58` | `bun typecheck` passes with the portal builder generics in place. |
| SATISFIED | validation | Required repo gates and targeted tests pass for the remediated diff | `bunx convex codegen`, `bun check`, `bun typecheck`, `bun run test -- convex/portals/__tests__/middleware.test.ts convex/auth/__tests__/resourceChecks.test.ts` | `bun check` still reports the repo's standing complexity warnings outside ENG-299, but there are no remaining errors in the touched scope. |

## Manual Checkpoint
- The issue's backend/runtime slice does not introduce a real route consumer. The proof queries and Convex tests cover the structural portal behavior owned by `ENG-299`; broader route-level smoke remains with downstream consumer adoption in `ENG-301`.

## External Review Notes
- CodeRabbit review is human-owned and excluded from the agent quality gate for this repo.

## Open Questions
- No code or spec gaps remain in the scope owned by `ENG-299`.
- There is still no dedicated `ENG-299` PR; the audit target remains the local branch diff against `origin/eng-297`.
