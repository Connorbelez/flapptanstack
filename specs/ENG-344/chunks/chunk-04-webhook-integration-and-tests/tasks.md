# Chunk: chunk-04-webhook-integration-and-tests

- [x] T-040: Route Stripe checkout events from `stripeWebhook` through reconciliation after raw event persistence and mark persisted events processed/failed with operation-visible errors.
- [x] T-041: Preserve the existing unsupported reversal bridge and add regression coverage for reversal behavior.
- [x] T-050: Add or update unit tests for event classification, metadata conflicts, transfer payload construction, and refund decisions.
- [x] T-051: Add or update Convex tests for active success, duplicate webhook replay, payment failure before expiry, late success refund, unknown checkout, and tampered metadata.
