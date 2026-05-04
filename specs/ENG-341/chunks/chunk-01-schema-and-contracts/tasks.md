# Chunk: chunk-01-schema-and-contracts

- [x] T-010: Add checkout session validators/constants for status, CAD 250 lock fee, five-minute expiry, selected lawyer type, Stripe metadata, and start-checkout input.
- [x] T-011: Add `dealLockCheckoutSessions` schema table with indexes by Stripe checkout id, listing/buyer/status, status/expiresAt, deal id, and idempotency key.
- [x] T-012: Add additive deal metadata for externally collected lock fee and Stripe checkout/payment identifiers without changing existing participant/fraction storage semantics.
- [x] T-013: Regenerate Convex types after schema and module additions.
