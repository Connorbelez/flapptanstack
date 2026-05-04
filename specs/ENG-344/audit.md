# Spec Audit: ENG-344 - Checkout: reconcile Stripe success, failure, and late success

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff for ENG-344
- Last run: 2026-04-25T20:10:35Z
- Verdict: ready

## Findings
- No unresolved spec-compliance findings.
- Resolved during review aggregation: Stripe success reconciliation now validates amount and currency before completing or refunding checkout success.
- Resolved during review aggregation: Late-success refund idempotency now keys by checkout session and PaymentIntent, rejects mismatched duplicate PaymentIntents, and avoids downgrading successful provider refunds when completion persistence fails.
- Resolved during review aggregation: Failed late-success refunds now have a public admin-gated retry action using the stored idempotency key.
- Resolved during review aggregation: Return-page polling now has an owned, read-only checkout status query and regression coverage proving repeated polling does not create extra transfers or webhook rows.
- Resolved during follow-up: Success after the checkout TTL has elapsed but before another process has changed `checkoutSessions.status` to `expired` now records `refunded_late_success`, creates a refund intent, and avoids transfer creation. Added Convex regression coverage for an active status with `expiresAt < Date.now()`.
- Resolved during audit: `payment_intent.payment_failed` webhook payloads were initially classified as checkout failures but used the PaymentIntent object ID as `stripeCheckoutSessionId`. Reconciliation now accepts failure events with no Checkout Session event ID, resolves by internal checkout metadata, preserves the existing stored `cs_...` ID, and records the PaymentIntent ID. Added unit and Convex regression coverage.

## Unresolved items
- none

## Next action
- Ready for final review aggregation.
