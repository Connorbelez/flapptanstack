# Chunk Context: chunk-01-backend-portal-contracts

## Goal
- Add the explicit portal public, lender, and lender-detail listing contracts on top of the landed portal registry, auth, middleware, and pricing seams.

## Relevant plan excerpts
- "Add explicit portal listing query contracts instead of relying on generic listing endpoints with optional `portalId`."
- "Clamp authenticated lender listing filters server-side from `lenderFilterConstraints` for the current portal relationship."
- "Reuse existing root `portalContext`, portal middleware and builders, and portal pricing helpers."

## Implementation notes
- `convex/fluent.ts` already exposes `portalPublicQuery`, `portalAuthedQuery`, and `portalLenderQuery`.
- `convex/portals/middleware.ts` already resolves the portal, same-portal access mode, lender identity, and typed portal pricing and filter-bound seams.
- `convex/listings/queries.ts` already contains low-risk shared pricing-aware list and detail logic, but the exported endpoints are still generic and do not enforce portal lender access.
- `convex/listings/marketplace.ts` already has production-ready list shaping that can be reused for portal teaser and lender list payloads.
- `lenderFilterConstraints` exists in `convex/schema.ts` but is not currently enforced by any listing query.

## Existing code touchpoints
- `convex/listings/queries.ts`
- `convex/listings/marketplace.ts`
- `convex/listings/portalQueries.ts`
- `convex/portals/middleware.ts`
- `convex/fluent.ts`
- `convex/listings/__tests__/queries.test.ts`

## Validation
- GitNexus impact on `listPublishedListings` is `LOW`.
- GitNexus impact on `getListingWithAvailability` is `LOW`.
- Add backend tests for portal public reads, portal lender reads, filter clamping, pricing projection, and wrong-portal rejection.
