# Chunk Context: chunk-01-schema-onboarding

## Goal
- Add explicit `portalId` storage and indexes to `borrowers` and `onboardingRequests`, then write `onboardingRequests.portalId` from trusted portal context when role requests are created from portal-aware surfaces.

## Relevant plan excerpts
- "Add `portalId` to `onboardingRequests` and `borrowers`."
- "Capture `onboardingRequests.portalId` from the server-resolved current portal at request creation time."
- "Keep the FairLend `app` portal inside the same explicit attribution contract as broker portals."

## Implementation notes
- The schema already has `portals` and `users.homePortalId`; this chunk only adds first-class attribution fields on onboarding and borrower entities plus indexes that make the later backfill deterministic.
- `requestRole` is currently an `authedMutation` with no portal argument. The safest cutover is to accept trusted portal context explicitly and re-resolve the portal server-side before persisting it.
- Preserve non-portal onboarding flows by failing closed only when a portal-aware caller claims portal context that does not resolve cleanly.

## Existing code touchpoints
- `convex/schema.ts`
- `convex/onboarding/mutations.ts:requestRole`
- `src/test/convex/onboarding/onboarding.test.ts`
- `src/test/convex/onboarding/helpers.ts`
- GitNexus impact: `requestRole` = LOW, no direct upstream dependants in the indexed graph.

## Validation
- `bunx convex codegen`
- `bunx vitest run src/test/convex/onboarding/onboarding.test.ts src/test/convex/onboarding/onboarding-queries.test.ts src/test/auth/integration/onboarding-auth.test.ts`
