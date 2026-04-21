# Execution Checklist: ENG-302 - Broker portal: add explicit borrower portal attribution on onboarding and borrower records

## Requirements From Linear
- [x] Add `portalId: Id<"portals">` to `onboardingRequests` and `borrowers`, including any indexes needed for deterministic backfill and portal-scoped borrower lookup.
- [x] Populate `onboardingRequests.portalId` from the trusted server-resolved current portal whenever a role request is created from a portal-aware surface.
- [x] Populate `borrowers.portalId` everywhere a borrower row is created or provisioned, including admin origination flows and canonical seed/helper paths used by tests.
- [x] Backfill existing onboarding and borrower rows deterministically, preferring onboarding attribution when present and otherwise falling back to `borrowers.orgId -> portals.by_org`.
- [x] Leave unresolved rows unset and report them explicitly instead of guessing a portal assignment.
- [x] Update `resolvePortalBorrower` and related proof/tests to use explicit borrower portal attribution rather than generic org equality.
- [x] Update any borrower-derived home-portal assignment helper to prefer explicit borrower attribution while keeping `users.homePortalId` as the viewer membership source of truth.
- [x] Preserve `ENG-299`'s structural boundary: portal membership remains in middleware and resource checks remain resource-scoped.
- [x] Keep the FairLend `app` portal in the same explicit attribution contract as broker portals.
- [x] Update seeds, fixtures, and direct test inserts so the explicit attribution schema is exercised consistently.

## Definition Of Done From Linear
- [x] `borrowers` and `onboardingRequests` carry explicit `portalId` attribution in the live schema.
- [x] New onboarding requests and borrower rows persist the correct portal without relying on later org-based inference.
- [x] Existing rows are backfilled deterministically or surfaced as unresolved with operator-visible reporting.
- [x] Borrower portal access in `convex/portals/middleware.ts` keys off explicit borrower attribution rather than `borrower.orgId === portal.orgId`.
- [x] Wrong-portal borrower access is denied even where old org-based matching would have allowed it.
- [x] `users.homePortalId` sync remains correct after the borrower attribution cutover.
- [x] Seeds and targeted tests reflect the new explicit attribution contract.
- [x] `bunx convex codegen`, `bun check`, `bun typecheck`, and targeted portal/onboarding/borrower tests pass.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit and integration tests added or updated for schema, onboarding mutation, borrower provisioning, backfill, home-portal assignment, and middleware denial paths.
- [x] E2E tests added or updated where a real browser auth or portal onboarding workflow changes.
  Expected to be unnecessary unless the backend change forces a route or auth-completion contract update.
- [x] Storybook stories added or updated where reusable UI changed.
  Expected to be unnecessary for this backend-focused slice unless a reusable portal onboarding component changes.

## Final Validation
- [x] All requirements are satisfied
- [x] All definition-of-done items are satisfied
- [x] Required quality gates passed
- [x] Test coverage expectations were met or explicitly justified
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded
