# Chunk Context: chunk-02-landing-query

## Goal
- Add one public portal landing-page read model that accepts an already resolved portal id and returns the approved v1 IA contract.

## Relevant plan excerpts
- "Define one explicit public landing query / builder instead of composing the page directly from scattered route reads."
- "Reuse `portalContext` and persisted portal rows as the source of structural host data; do not re-resolve hosts in leaf consumers."
- "Keep featured-listing fields aligned with live listing projection or the landing page will drift from the marketplace experience."

## Implementation notes
- Query input should be `portalId: v.id("portals")`, matching root `portalContext.portal.portalId`.
- Return `null` for missing or inactive/unpublished portals only if root rendering should fail closed; otherwise return deterministic fallback content for active portals even when optional copy rows are missing.
- Use `portal.publicTeaserEnabled`, `portal.teaserListingLimit`, and active portal pricing selection for teaser listings.
- Avoid auth-gated listing queries for anonymous landing rendering; use the public portal listing seam.

## Existing code touchpoints
- `convex/portals/queries.ts`: current public portal summary queries.
- `convex/listings/portalQueries.ts`: public teaser listing query pattern.
- `convex/listings/marketplace.ts`: `listMarketplaceListingsSnapshot` live projection helper.
- `convex/portals/pricing.ts`: pricing selection helpers.

## Validation
- Targeted Convex tests in `convex/portals/__tests__/landing.test.ts`.
