# Chunk: chunk-03-webhooks-transition

- [x] T-030: Add Documenso webhook verification helper/action.
- [x] T-031: Create `convex/deals/envelopeWebhooks.ts` with HTTP handler, parser, persistence, dedupe, and status updates.
- [x] T-032: Normalize provider events into attempt/recipient state idempotently.
- [x] T-033: Emit `ALL_PARTIES_SIGNED` through internal transition mutation after verified completion.
