# Execution Checklist: ENG-340 - Checkout: implement two-phase hosted Stripe start

## Requirements From Linear
- [x] Return `StartMarketplaceCheckoutResult` with `{ ok: true; checkoutSessionId; stripeCheckoutUrl; expiresAt }` or typed failure codes.
- [x] Validate auth, portal, listing status, production `mortgageId`, lender visibility, fractions, and lawyer before reservation creation.
- [x] Reject demo listings and hidden/filtered listings before creating any lock.
- [x] Resolve seller and buyer ledger accounts canonically.
- [x] Create `ledger_reservations` and `checkoutSessions` in one internal mutation with status `preparing_provider_session` and five-minute expiry.
- [x] Create hosted Stripe Checkout for CAD 250 lock fee with required metadata and idempotency derived from internal checkout session id.
- [x] Attach Stripe ids and transition to `hosted_checkout_open` before returning URL.
- [x] On Stripe/provider failure or attach failure, transition to `provider_start_failed`, void reservation, record `failureReason`, and journal the rejection.
- [x] Duplicate start calls must not create duplicate reservations or provider sessions.

## Definition Of Done From Linear
- [x] Successful start returns a hosted Stripe URL only after reservation, checkout session, and provider session are linked.
- [x] Provider-start and provider-attach failures compensate and void reservations.
- [x] Server-side validation happens before lock creation.
- [x] Race tests prove no oversell and no dangling second reservation.
- [x] No webhook, deal, expiry, refund, or UI implementation is included.
- [x] `bunx convex codegen`, `bun check`, and `bun typecheck` pass.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated where backend or domain logic changed.
- [x] E2E tests added or updated where an operator or user workflow changed, or explicitly justified as deferred.
  - Backend-only action/mutation slice; no browser workflow or UI surface was added in ENG-340.
- [x] Storybook stories added or updated where reusable UI changed, or explicitly justified as not applicable.
  - No reusable UI component changed in ENG-340.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] Required quality gates passed.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
