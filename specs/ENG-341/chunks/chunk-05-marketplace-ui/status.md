# Status: chunk-05-marketplace-ui

- Result: complete
- Last updated: 2026-04-24T20:40:11Z

## Completed tasks
- T-050
- T-051
- T-052

## Validation
- `bun run test src/test/listings/marketplace-listing-detail-page.test.tsx`: pass
- E2E listing lock flow: not-run; no mocked browser Stripe return flow was introduced, and changed behavior is covered by component plus Convex webhook/session tests.

## Notes
- Client checkout state must not become authority for buyer, seller, price, fraction availability, or lawyer validity.
- Marketplace detail exposes checkout only when fractions are available, closing-team lawyer options exist, and Stripe provider config is present. Checkout action revalidates authority server-side before reservation or Stripe creation.
