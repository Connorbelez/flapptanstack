# Chunk: chunk-03-late-success-refunds

- [x] T-030: Create `convex/checkout/refunds.ts` with late-success refund intent/completion/failure persistence and an explicit retryable helper surface.
- [x] T-031: Ensure late success after `expired`, `abandoned`, or terminal-invalid state records no deal-ready success and no confirmed transfer.
