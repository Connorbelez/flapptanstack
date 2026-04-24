# Chunk: chunk-02-checkout-start

- [x] T-020: Implement pure helpers that re-read and validate published listing, mortgage linkage, availability, fraction units, buyer/seller identity, and selected lawyer.
- [x] T-021: Implement checkout-start mutation/action split that requires authenticated lender access, creates or reuses temporary ledger reservation with stable idempotency, creates Stripe Checkout, persists session, and returns redirect/session state.
- [x] T-022: Implement session expiry/failure/abandonment mutation that voids pending reservations and records terminal status without creating deals.
- [x] T-023: Add Convex tests for checkout-start validation, idempotent replay, reservation creation, reservation cleanup on provider failure, and expiry/void behavior.
