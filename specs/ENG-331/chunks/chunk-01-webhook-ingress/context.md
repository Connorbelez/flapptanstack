# Chunk Context: chunk-01-webhook-ingress

## Goal
- Add the Velocity webhook ingress surface, authenticate requests, persist raw events with provenance, and hand accepted events to the shared full-deal sync path.

## Relevant plan excerpts
- Production HTTP route: `POST /api/velocity/webhook`.
- Webhooks are notification-only: persist the webhook, then fetch the full deal before mutating package state.
- Webhook response shape: `{ ok: true; acceptedEvents: number; duplicateEvents: number }` or `{ ok: false; error: "unauthorized" | "invalid_payload" }`.
- Webhook event idempotency key recommendation: `velocity:webhook:<loanCode>:<event.timestamp>:<event.eventType>:<event.deal.status>`.

## Implementation notes
- Use `convex/http.ts` as the route registry, following the payment webhook pattern.
- Use a FairLend-controlled shared secret or endpoint token from deployment env because Velocity docs do not define a request signature scheme.
- The handler must reject unauthenticated requests before business work.
- For authenticated requests, persist raw event rows before invoking sync. One webhook payload may contain multiple events.
- Persist `VelocityWebhookAgent` from the payload and a `VelocityConnectorCredentialContext` for webhook ingress. Full-deal fetch provenance will be added by the sync path.
- The webhook must not patch workspace state from `status`, `loanCode`, or any other webhook payload field except as event metadata and fetch locator.

## Existing code touchpoints
- `convex/http.ts`: add the new route.
- `convex/payments/webhooks/rotessaPad.ts`: reference HTTP webhook style and `jsonResponse` helper usage.
- `convex/payments/webhooks/utils.ts`: shared `jsonResponse` helper.
- `convex/velocity/constants.ts`: existing idempotency helpers and Velocity status constants.
- `convex/velocity/validators.ts`: existing `velocityWebhookPayloadValidator`, `velocityWebhookAgentValidator`, and credential validator.
- `convex/schema.ts`: existing `velocityWebhookEvents` table with provenance fields.
- GitNexus impact checks to run before edits: `http`, `buildVelocityWebhookEventIdempotencyKey`, `velocityWebhookPayloadValidator`.

## Validation
- Targeted tests for unauthorized request rejection, invalid payload response, raw event persistence, duplicate webhook no-op, and no workspace mutation from webhook-only payload.
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
