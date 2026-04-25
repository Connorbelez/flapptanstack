# Chunk: chunk-02-transfer-and-checkout-state

- [x] T-021: Add active success handling that creates or reuses one `locking_fee_collection` transfer through `createTransferRequestRecord`.
- [x] T-022: Patch checkout sessions with Stripe refs, `lockFeeTransferRequestId`, `completedAt`/`resolvedAt`, `lastProviderEventId`, and `completed` status only when internal state permits it.
- [x] T-023: Add retryable payment failure handling that transitions active sessions to `payment_failed_retryable` without voiding reservations or extending TTL.
