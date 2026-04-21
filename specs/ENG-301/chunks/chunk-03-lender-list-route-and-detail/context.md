# Chunk Context: chunk-03-lender-list-route-and-detail

## Goal
- Ship the authenticated lender listings route and align lender detail reads with the explicit portal contract and portal-scoped query cache path.

## Relevant plan excerpts
- "Add the authenticated portal listings consumer under the existing lender route shell and keep detail navigation on the same portal-aware query contract."
- "Portal query and cache boundaries prevent stale listing data from leaking across hosts on the same pathname."

## Implementation notes
- `src/routes/lender.listings.tsx` is currently only an `Outlet`; there is no index route for `/lender/listings`.
- `src/components/lender/listings/LenderListingDetailPage.tsx` currently uses `convex/react` `useQuery`, which bypasses the TanStack Query portal-cache scoping in `src/router.tsx`.
- `/lender` already enforces lender route access, but the backend listing read still needs same-portal structural enforcement from the new portal lender contract.
- The authenticated list route can reuse the production filter and map components already used by the marketplace surface.

## Existing code touchpoints
- `src/routes/lender.listings.tsx`
- `src/routes/lender.listings.index.tsx`
- `src/routes/lender.listings.$listingId.tsx`
- `src/components/lender/listings/LenderListingDetailPage.tsx`
- `src/components/listings/query-options.ts`
- `src/components/listings/MarketplaceListingsPage.tsx`
- `src/test/lender/listing-detail-page.test.tsx`

## Validation
- `/lender/listings` uses the explicit portal lender list contract.
- `/lender/listings/$listingId` uses the explicit portal lender detail contract.
- Frontend tests verify portal args and TanStack Query-based consumer wiring.
