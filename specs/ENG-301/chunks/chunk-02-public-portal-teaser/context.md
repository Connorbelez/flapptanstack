# Chunk Context: chunk-02-public-portal-teaser

## Goal
- Replace the root portal-host debug surface with a real public teaser listing consumer while preserving the existing marketing and admin host branches.

## Relevant plan excerpts
- "Create the minimum portal-facing route consumers needed to prove root portal context, host-aware cache scoping, portal-state boundaries, and pricing projection work end to end."
- "Reuse existing root blocked-host and portal-state boundaries for invalid hosts, and add explicit in-surface empty or unavailable states only where valid portal hosts have no teaser or list results."

## Implementation notes
- `src/routes/index.tsx` currently renders a root portal-context debug card for every host type.
- `src/routes/__root.tsx` already supplies `portalContext`, `portalCacheKey`, and blocked-host redirect behavior before child routes render.
- The existing production listing UI under `src/components/listings` is safe to reuse; the demo broker-whitelabel routes must remain references only.
- Portal teaser behavior must respect `portal.publicTeaserEnabled` and `portal.teaserListingLimit`.

## Existing code touchpoints
- `src/routes/index.tsx`
- `src/routes/__root.tsx`
- `src/components/listings/ListingGridShell.tsx`
- `src/components/listings/listing-card-horizontal.tsx`
- `src/components/listings/listing-map-popup.tsx`
- `src/components/portal/portal-state-boundary.tsx`

## Validation
- Portal hosts render a teaser surface from the explicit portal public query contract.
- Marketing and admin hosts still render non-portal root content.
- Valid portal hosts without teaser results render an explicit in-surface empty or unavailable state.
