# Summary: ENG-350 - Listing detail: enable hosted checkout launch UI

- Source issue: https://linear.app/fairlend/issue/ENG-350/listing-detail-enable-hosted-checkout-launch-ui
- Primary plan: https://www.notion.so/34cfc1b440248179b276dd7a9abf4770
- Supporting docs:
  - https://www.notion.so/329fc1b440248117a4ffce6eef90b20a
  - https://www.notion.so/329fc1b440248106b45ef400bfe497db
  - docs/architecture/rbac-and-permissions.md

## Scope
- Promote eligible production `/listings/$listingId` detail pages from read-only to a hosted checkout launcher.
- Add server-shaped checkout launcher DTOs for fraction bounds, CAD 250 lock fee copy, lawyer selection, start API payloads, and return states.
- Wire the frontend to `api.checkout.actions.startMarketplaceCheckout`, redirect only to the backend returned Stripe Checkout URL, and render backend failures without redirecting.
- Preserve read-only states for demo, missing mortgage, unavailable, or backend-disabled listings.
- Add RTL coverage for enabled, disabled, validation, redirect, provider failure, double-submit, and return-state behavior.

## Constraints
- Hosted Stripe Checkout is the only payment surface; do not implement embedded card fields or Stripe Elements.
- Client availability, lock fee, listing status, portal visibility, and lawyer labels are display/input hints only; server checkout validation remains authoritative.
- Authenticated suspense route trees must keep the `Authenticated` / `AuthLoading` wrapper.
- Use `useAuth` from `@workos/authkit-tanstack-react-start/client` only if frontend auth state is needed.
- Do not expand into backend checkout start, webhooks, refunds, expiry jobs, or deal creation.
- GitNexus impact before edits: `ListingDetailPage`, `MarketplaceListingDetailPage`, `buildMarketplaceListingDetailModel`, `getMarketplaceListingDetail`, and `marketplaceListingDetailQueryOptions` are LOW risk; only `marketplaceListingDetailQueryOptions` reports one direct route caller.

## Open questions
- none
