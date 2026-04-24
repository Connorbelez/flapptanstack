# Chunk: chunk-03-webhook-success

- [x] T-030: Extend Stripe webhook event typing and persistence branch for `checkout.session.completed` while preserving signature verification and existing reversal handling.
- [x] T-031: Implement success processing that resolves FairLend session by Stripe checkout session id, handles duplicate/unknown/out-of-order events, enforces expiry, and records refund-needed/refunded late-success state.
- [x] T-032: Implement idempotent success-to-deal creation that writes deal participant/fraction/lawyer/reservation/payment metadata, grants buyer/seller/lawyer access, links reservation, and emits `DEAL_LOCKED` through the Transition Engine.
- [x] T-033: Add webhook/session tests for valid success, late success no-deal, unknown session, duplicate events, and existing reversal regression.
