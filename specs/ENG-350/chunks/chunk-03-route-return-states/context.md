# Chunk Context: chunk-03-route-return-states

## Goal
- Thread route/search return context into the listing detail page and render internal checkout status states.

## Relevant plan excerpts
- "Render success/pending, canceled/abandoned, expired, provider failure, and generic error from internal checkout state where available."
- "Preserve authenticated wrapper pattern and avoid suspense subscription before auth is ready."

## Implementation notes
- `src/routes/listings/route.tsx` already wraps children in `Authenticated` and `AuthLoading`; preserve this.
- If no internal checkout status query is exposed, render return-state copy from controlled route/search context without trusting Stripe query params as proof of payment.
- Keep query/search parsing narrowly scoped to listing detail route behavior.

## Existing code touchpoints
- `src/routes/listings/$listingId.tsx`: uses `useSuspenseQuery` under the wrapper.
- `src/routes/listings/route.tsx`: existing auth wrapper pattern; avoid unnecessary changes.
- `src/components/listings/MarketplaceListingDetailPage.tsx`: can receive route return state props.

## Validation
- Route tests if route search/schema changes.
- RTL tests for success/pending, canceled/abandoned, expired, provider failure, and generic error display.
