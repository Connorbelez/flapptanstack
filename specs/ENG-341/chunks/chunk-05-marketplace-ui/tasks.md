# Chunk: chunk-05-marketplace-ui

- [x] T-050: Extend marketplace listing detail snapshot/model types with checkout readiness, provider/config state, and lawyer options required by the production CTA.
- [x] T-051: Wire `MarketplaceListingDetailPage` and `ListingDetailPage` to call checkout start and redirect to Stripe, with disabled/error states for unauthenticated, provider missing, no available fractions, invalid selection, no lawyer, and backend rejection.
- [x] T-052: Update listing detail component tests for enabled checkout, redirect, disabled provider/config state, invalid selection, and backend errors.
