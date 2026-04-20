# Chunk Context: chunk-01-portal-schema

## Goal
- Deliver the persisted Convex portal contract: schema, typed registry lookups, and tracked FairLend seed/backfill flows for portal rows and `users.homePortalId`.

## Relevant plan excerpts
- `portals` fields: `slug`, `portalType`, `brokerId`, `orgId`, `productionHost`, `localHost`, `status`, `isPublished`, `publicTeaserEnabled`, `teaserListingLimit`, `defaultPostAuthPath`, `landingPageId`, `pricingPolicyId`, `createdAt`, `updatedAt`.
- `users.homePortalId` is the canonical non-admin post-auth portal-routing field.
- `app.fairlend.ca` and `app.localhost:3000` must resolve through a persisted FairLend portal row, not special fallback logic.

## Implementation notes
- Reuse the tracked migration pattern already established in `convex/brokers/migrations.ts`; do not invent a one-off seed script.
- Reuse existing broker/org relationships and onboarding subdomain intent instead of redesigning producer flows.
- Keep `portalLandingPages` and `portalPricingPolicies` intentionally thin with explicit comments that they are downstream-owned attachment points.
- Keep exported Convex surfaces on fluent-convex builders with explicit visibility.

## Existing code touchpoints
- `convex/schema.ts`
- `convex/brokers/migrations.ts`
- `convex/lib/orgScope.ts`
- `convex/fluent.ts`
- existing broker, lender, borrower, and onboarding schema relationships

## Validation
- `bunx convex codegen`
- `bunx vitest run convex/portals/__tests__/lookup.test.ts convex/portals/__tests__/migrations.test.ts`
