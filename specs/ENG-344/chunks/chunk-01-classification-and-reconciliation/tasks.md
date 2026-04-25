# Chunk: chunk-01-classification-and-reconciliation

- [x] T-010: Extend `convex/payments/webhooks/stripe.ts` with hosted checkout success/failure classification that does not regress reversal classification.
- [x] T-011: Add strict checkout event payload extraction for Checkout Session ID, PaymentIntent ID, status, metadata, and provider event IDs.
- [x] T-020: Create `convex/checkout/reconciliation.ts` with idempotent checkout lookup, metadata conflict checks, active/expired decision logic, and safe replay handling.
