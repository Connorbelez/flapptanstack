# Execution Checklist: ENG-345 - Checkout: expire abandoned sessions and release reservations

## Requirements From Linear
- [x] Enforce `expiresAt = startedAt + 5 minutes` as internal truth; do not extend TTL on payment failure or retry.
- [x] Implement a scheduled sweep or equivalent action that finds active sessions by `by_status_expires_at` where status is `preparing_provider_session`, `hosted_checkout_open`, or `payment_failed_retryable` and `expiresAt <= now`.
- [x] Expiry must transition the checkout session to `expired`, set `resolvedAt`/`updatedAt`, preserve `failureReason` or expiry reason, and be idempotent.
- [x] Expiry must void the linked `ledger_reservations` row with an idempotency key tied to the checkout session and reason.
- [x] Expiry must attempt to expire the hosted Stripe Checkout Session when `stripeCheckoutSessionId` exists and the provider session may still be open.
- [x] Provider-expiry failure must not leave the reservation active. Record the failure for operations and let Stripe late-success handling refund through ENG-344.
- [x] Explicit user abandonment must transition to `abandoned`, expire provider if possible, void the reservation, and journal the user/system actor.
- [x] Payment failure inside TTL may keep reservation pending and set `payment_failed_retryable`; retry must reuse the existing internal session or create a provider replacement linked to the same internal checkout session and original TTL.
- [x] Expired or abandoned sessions cannot be moved to deal-ready success by this issue.
- [x] Availability after expiry/abandonment must be visible through existing ledger-derived marketplace availability, not through a listing counter.

## Definition Of Done From Linear
- [x] Five-minute FairLend expiry is enforced independently of Stripe.
- [x] Expired and abandoned sessions always release reservations and restore ledger-derived availability.
- [x] Retry inside TTL is supported without TTL extension.
- [x] Provider expiry attempts and failures are visible to operations.
- [x] Race/idempotency tests cover duplicate sweeps and success-vs-expiry conflict.
- [x] Required commands pass.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit/backend tests added or updated for checkout expiry, abandon authorization, provider failure, duplicate replay, retry TTL, and reservation release.
- [x] Marketplace availability is verified after reservation void through existing ledger-derived availability.
- [x] E2E browser tests are not required because this issue has no UI controls or route workflow changes; record this as justified during closeout.
- [x] Storybook stories are not required because this issue has no reusable UI changes; record this as justified during closeout.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] `bunx convex codegen` passes.
- [x] `bun check` passes.
- [x] `bun typecheck` passes.
- [x] Targeted checkout expiry tests pass.
- [x] Targeted ledger reservation tests pass or are covered by checkout tests that assert ledger release.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
