# Chunk Context: chunk-02-checkout-ui

## Goal
- Replace production checkout copy/card-entry mock with an accessible hosted checkout launcher.

## Relevant plan excerpts
- "Do not call Stripe directly from browser except navigating to hosted URL returned by backend."
- "Do not implement embedded Stripe Elements or PaymentIntent-first UI."
- "Require lawyer selection; support platform and guest lawyer snapshots."

## Implementation notes
- Keep the UI a thin client: submit listing ID, portal ID, requested fraction count, and selected lawyer snapshot only.
- Disable submission for invalid local input, missing lawyer, pending mutation, and read-only/ineligible states.
- On successful backend result, set `window.location.href` or `window.location.assign` to the returned `stripeCheckoutUrl`.
- Render backend errors and missing hosted URL errors inline with a retry path where appropriate.

## Existing code touchpoints
- `src/components/listings/ListingDetailPage.tsx`: `ListingDetailPage`, LOW GitNexus impact.
- `src/components/listings/MarketplaceListingDetailPage.tsx`: passes mode and launcher handler into shared detail page.

## Validation
- RTL tests for validation, disabled states, successful redirect, backend errors, double submit, and read-only paths.
- `bun check` and `bun typecheck` after implementation.
