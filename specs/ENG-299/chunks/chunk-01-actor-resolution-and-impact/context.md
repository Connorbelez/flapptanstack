# Chunk Context: chunk-01-actor-resolution-and-impact

## Goal
- Finalize the implementation plan state for the active branch, record blast radius for the auth/resource seams, and extract shared actor-resolution helpers that portal middleware can reuse without changing existing resource-scoped behavior.

## Relevant plan excerpts
- Extract shared actor-resolution helpers rather than duplicating user or broker lookups inside new portal middleware.
- Keep portal membership and resource ownership as separate layers: portal checks happen first, resource checks remain resource-scoped.

## Implementation notes
- `ENG-297` already landed `portals`, `users.homePortalId`, and portal lookup queries; this chunk should not recreate any portal persistence or host-resolution logic.
- Current identity resolution lives privately in `convex/auth/resourceChecks.ts` as `getUserByAuthId`, `getBrokerByAuthId`, `getBorrowerByAuthId`, and `getLenderByAuthId`.
- Borrower attribution in the current data model is broker-org based (`borrowers.orgId` -> portal `orgId`), while lender attribution is broker based (`lenders.brokerId` -> portal `brokerId`); shared helpers should preserve those lookup paths for later portal middleware stages.
- The extraction must avoid silently changing resource-access semantics for existing callers such as document, transfer, workout, and cash-ledger checks.

## Existing code touchpoints
- `convex/auth/resourceChecks.ts`
- `convex/authz/resourceAccess.ts`
- `convex/brokers/migrations.ts`
- `src/test/auth/helpers.ts`
- GitNexus impact:
  - `canAccessMortgage`: MEDIUM risk, direct callers are `canAccessBorrowerEntity`, `canAccessObligation`, `canAccessTransferRequest`, `canAccessCashLedgerAccount`, `canAccessWorkoutPlan`, and `canAccessDocument`
  - `getLenderMortgageIds`: LOW risk, direct callers are `canAccessMortgage` and `canAccessLedgerPosition`
  - `authMiddleware` and `requireOrgContext`: GitNexus reported LOW with no tracked dependents in this checkout; manual inspection still shows broad builder-chain reuse in `convex/fluent.ts`, so changes there need conservative review

## Validation
- `npx gitnexus impact authMiddleware --repo t3code-3f717be5 --direction upstream --depth 3 --include-tests`
- `npx gitnexus impact requireOrgContext --repo t3code-3f717be5 --direction upstream --depth 3 --include-tests`
- `npx gitnexus impact canAccessMortgage --repo t3code-3f717be5 --direction upstream --depth 3 --include-tests`
- `npx gitnexus impact getLenderMortgageIds --repo t3code-3f717be5 --direction upstream --depth 3 --include-tests`
- Targeted resource-access tests after extraction
