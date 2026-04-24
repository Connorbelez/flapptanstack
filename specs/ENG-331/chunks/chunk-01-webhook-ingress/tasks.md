# Chunk: chunk-01-webhook-ingress

- [x] T-010: Register `POST /api/velocity/webhook` in `convex/http.ts`.
- [x] T-011: Create `convex/velocity/webhook.ts` with authenticated HTTP handling, payload parsing, unauthorized/invalid responses, and event extraction.
- [x] T-012: Persist raw webhook events with idempotency key, webhook agent, connector credential context, raw body, event status, and deal href before sync processing.
- [x] T-013: Wire webhook processing to the shared full-deal sync path without mutating workspace state from webhook payload fields.
