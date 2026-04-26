# Chunk Context: chunk-04-middleware-tests

## Goal
- Replace the transitional org-based borrower mapping in portal middleware with explicit borrower `portalId` checks and lock the regression coverage around wrong-portal denial.

## Relevant plan excerpts
- "Update `resolvePortalBorrower` and related proof/tests to key off explicit borrower portal attribution instead of `borrower.orgId === portal.orgId`."
- "Wrong-portal borrower access is denied even if org-based data would have matched previously."

## Implementation notes
- `resolvePortalBorrower` already isolates the temporary ENG-299 mapping. This chunk should localize the cutover there rather than reworking unrelated access helpers.
- Keep `resolvePortalAccess` and admin override semantics unchanged; only borrower ownership resolution should change.
- Update existing portal proof and middleware tests instead of inventing new coverage from scratch where the current harness already exercises borrower/lender/admin flows.

## Existing code touchpoints
- `convex/portals/middleware.ts:resolvePortalBorrower`
- `convex/portals/proof.ts`
- `convex/portals/__tests__/middleware.test.ts`
- GitNexus impact: `resolvePortalBorrower` = LOW; direct caller `withPortalBorrower`, 3 affected processes.

## Validation
- `bunx vitest run convex/portals/__tests__/middleware.test.ts`
