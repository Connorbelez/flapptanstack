# Chunk: chunk-01-checkout-runtime

- [x] T-010: Add checkout expiry/abandon idempotency-key helpers and active-status sweep helpers.
- [x] T-011: Implement internal expire-one-session mutation with active-status guard, terminal idempotency, provider attempt fields, and `voidReservationHandler`.
- [x] T-012: Implement explicit abandon mutation/action with owner/admin authorization and the same release path.
- [x] T-013: Preserve retry-within-TTL semantics without extending `expiresAt`.
