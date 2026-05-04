# Chunk Context: chunk-02-route-wiring

## Goal
- Route landing lender actions through the canonical public handoff and then into host-aware auth with `/listings` as the real runtime destination.

## Relevant plan excerpts
- "Wire the lender switchboard CTA to that seam and preserve host-aware auth redirects."
- "Wire teaser-card and `View All` interactions into the same journey family."
- "Avoid public routes nested under auth-gated trees unless the first step is intentionally authenticated."

## Implementation notes
- Add `/start-lending` outside auth-gated trees.
- The route should consume root `portalContext`, record the backend handoff, and redirect to `/sign-up?redirect=/listings`.
- Landing contract defaults should make switchboard lender CTA and `View All` point to `/start-lending`; teaser cards should include listing-specific handoff URLs.
- Preserve product-like teaser presentation; card links should look like listing product interactions, not marketing explanations.

## Existing code touchpoints
- `src/routes/index.tsx`
- `src/components/portal/landing/PortalLandingPage.tsx`
- `src/components/portal/landing/landing-types.ts`
- `src/routes/sign-up.tsx`
- `src/lib/portal/auth-initiation.ts`
- `convex/portals/queries.ts:buildSwitchboard`, `buildFeaturedListings`, `toLandingListingItem`
- GitNexus impact must run before edits on existing symbols.

## Validation
- `bun run test -- src/test/routes/portal-home-route.test.tsx`
- Targeted route/server function tests for `/start-lending` if the route is unit-testable in the current harness.
