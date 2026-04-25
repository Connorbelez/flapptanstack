# Execution Checklist: ENG-344 - Checkout: reconcile Stripe success, failure, and late success

## Requirements From Linear
- [x] Extend Stripe webhook handling to recognize hosted checkout success and payment failure events needed for Checkout Sessions, without breaking existing reversal handling.
- [x] Persist raw provider events before returning success to Stripe; duplicate provider event ids must replay idempotently.
- [x] Resolve checkout sessions by `stripeCheckoutSessionId` and internal metadata. Trust the internal checkout session and reservation state, not client return query params.
- [x] If Stripe success arrives while checkout is active and unexpired, create or confirm exactly one inbound `transferRequests` row with `transferType = "locking_fee_collection"`, `direction = "inbound"`, `amount = 25000`, `currency = "CAD"`, `providerCode = "stripe"`, domain `lenderId`, and Stripe refs in provider fields/metadata.
- [x] Store Stripe Checkout Session ID and PaymentIntent ID on both the checkout session and transfer metadata where available.
- [x] Mark the checkout session payment outcome ready for downstream deal creation without creating the deal in this issue.
- [x] If payment fails inside the active TTL, transition to `payment_failed_retryable` without voiding the reservation and without extending TTL.
- [x] If provider success arrives after the internal checkout session is `expired`, `abandoned`, or otherwise terminal-invalid, do not create transfer-confirmed success for deal creation; record `refunded_late_success`, refund intent/completion, and journals.
- [x] Refund failures must be visible to operations and retryable by an explicit helper or admin path.
- [x] Reconciliation must be idempotent across duplicate webhook delivery, return-page polling, and action retries.

## Definition Of Done From Linear
- [x] Hosted Stripe success/failure events reconcile idempotently.
- [x] One valid active success creates exactly one lock-fee transfer and links it to checkout session.
- [x] Late success after FairLend expiry creates no deal-ready state and records refund intent/completion.
- [x] Duplicate webhook and return polling paths are safe.
- [x] Existing Stripe reversal behavior remains covered.
- [x] Required commands pass.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated for Stripe checkout event classification, metadata parsing/conflict checking, transfer payload building, and refund decision logic.
- [x] Convex/backend tests added or updated for active success, duplicate webhook replay, retryable payment failure, late success refund path, and unknown/conflicting metadata persistence.
- [x] E2E tests are not added for this backend/payment slice; browser-level checkout is explicitly deferred to hardening.
- [x] Storybook stories are not applicable because this issue changes backend reconciliation only.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] `bunx convex codegen` passed.
- [x] `bun check` passed.
- [x] `bun typecheck` passed.
- [x] Targeted Stripe webhook / checkout reconciliation / transfer tests passed.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
