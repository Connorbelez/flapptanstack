# Chunk: chunk-02-provider-and-cron

- [x] T-020: Add provider expiry attempt action/helper that calls `CheckoutProvider.expireHostedCheckoutSession` and records success/failure without blocking reservation void.
- [x] T-021: Add bounded sweep action that pages active expired sessions by `by_status_expires_at`.
- [x] T-022: Register a fixed checkout expiry interval in `convex/crons.ts`.
