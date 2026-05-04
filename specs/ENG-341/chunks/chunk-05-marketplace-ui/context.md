# Chunk Context: chunk-05-marketplace-ui

## Goal
- Turn production marketplace listing detail from read-only lock scaffolding into a guarded checkout-start surface with redirect and clear disabled/error states.

## Relevant plan excerpts
- "Production listing detail must call the checkout-start API and redirect to Stripe only when transaction workflows/provider config are available; otherwise keep clear disabled states."
- "Marketplace listing detail has covered UI states for start checkout, redirect, disabled provider/config state, invalid selection, and backend errors."

## Implementation notes
- Current `MarketplaceListingDetailPage` always renders `ListingDetailPage` with `mode="readOnly"`, so the checkout controls never show in production.
- `ListingDetailPage` already has interactive checkout scaffolding based on `listing.checkout`, selected fractions, and selected lawyer.
- Extend types carefully so client values remain selection hints only; backend checkout-start must re-read all critical listing, participant, fraction, and lawyer state.
- Keep disabled states visible when provider config/readiness is missing or listing availability is zero.
- Use `useAuth` from `@workos/authkit-tanstack-react-start/client` if auth state is needed in React components.

## Existing code touchpoints
- `src/components/listings/ListingDetailPage.tsx`: existing fraction/lawyer checkout UI.
- `src/components/listings/MarketplaceListingDetailPage.tsx`: currently forces read-only mode.
- `src/components/listings/listing-detail-types.ts`: checkout model.
- `src/components/listings/marketplace-detail-adapter.ts`: converts Convex snapshot into UI model.
- `src/routes/listings/$listingId.tsx`: route loader and authenticated detail screen.
- `src/test/listings/marketplace-listing-detail-page.test.tsx`: current test asserts production has no checkout.
- GitNexus impact: `ListingDetailPage` LOW.

## Validation
- Component tests for checkout enabled state, mutation call payload, redirect handling, disabled provider/config, invalid selection, no lawyer, unauthenticated state, and backend rejection.
- E2E test only if implementation adds a browser-visible mocked Stripe return path.
