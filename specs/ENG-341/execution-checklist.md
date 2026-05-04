# Execution Checklist: ENG-341 - Deal closing: create deals from verified listing-lock checkout

## Requirements From Linear
- [x] Add a durable `DealLockCheckoutSession` store with listing, mortgage, buyer, seller, selected lawyer, fraction units, lock fee amount, reservation id, Stripe checkout session id, status, expiry, optional deal id, and timestamps.
- [x] Checkout start must require authenticated WorkOS identity and active listing access, then re-read listing, mortgage, availability, buyer/seller, selected lawyer, price, and fraction data server-side before creating any reservation or Stripe session.
- [x] Checkout start must reject invalid fraction units, unavailable fractions, missing listing/mortgage linkage, invalid or unavailable selected lawyer, and unauthenticated users before contacting Stripe.
- [x] Checkout start must create or reuse a temporary ledger reservation using existing reservation primitives and a stable session-scoped idempotency key before redirecting to Stripe Checkout.
- [x] Hosted Stripe Checkout must collect exactly CAD 250 and include metadata sufficient to resolve the FairLend checkout session without trusting client state.
- [x] FairLend sessions must expire after five minutes; expired, abandoned, or failed sessions must void the temporary reservation and must not leave an active deal.
- [x] Verified Stripe success must persist the webhook event, resolve the FairLend session by Stripe checkout session id, enforce idempotency and session expiry, and create a deal only when the session is valid.
- [x] Late Stripe success after `expiresAt` must initiate refund or mark the session for refund/refunded and must not create a deal.
- [x] Deal creation must persist buyer, seller, selected fraction units, selected lawyer auth id/type, reservation linkage, locking fee amount, and Stripe payment identifiers using the ENG-338 contract.
- [x] Deal creation must emit `DEAL_LOCKED` through the Transition Engine and must not patch `deals.status` directly.
- [x] `DEAL_LOCKED` effects must be compatible with pre-created reservations and externally collected Stripe lock fees; no duplicate reservation, fee transfer, package, access grant, or deal may be created by retries.
- [x] Duplicate Stripe events and repeated checkout-start calls with the same idempotency context must return existing session/deal state instead of duplicating side effects.
- [x] Production listing detail must call the checkout-start API and redirect to Stripe only when transaction workflows/provider config are available; otherwise it must keep clear disabled states.
- [x] All critical outcomes must be auditable/queryable: created, paid, expired, refunded, failed, deal-created, and webhook-retry paths.
- [x] Keep all exported Convex functions on fluent builders with explicit `.public()` or `.internal()` visibility where applicable, and preserve existing Stripe webhook signature verification behavior.

## Definition Of Done From Linear
- [x] Marketplace listing lock cannot create a deal before verified Stripe payment success.
- [x] A valid in-window Stripe success creates exactly one deal with buyer, seller, selected fraction units, selected lawyer, reservation linkage, locking fee, and package initialization context.
- [x] Late, failed, abandoned, duplicate, and out-of-order checkout/webhook paths do not create duplicate deals, reservations, packages, access grants, or fee transfers.
- [x] Temporary reservations are voided for expired/failed/abandoned sessions and linked to the deal on valid success.
- [x] `DEAL_LOCKED` is emitted through the governed transition engine; no implementation code directly patches deal status.
- [x] `reserveShares` and `collectLockingFee` behavior is explicitly tested for pre-created checkout reservations and externally collected Stripe fees.
- [x] Stripe webhook handling verifies signatures, persists provider events, and handles checkout success without regressing existing reversal/failure persistence tests.
- [x] Marketplace listing detail has covered UI states for start checkout, redirect, disabled provider/config state, invalid selection, and backend errors.
- [x] Admin/backoffice deal surfaces can observe the created deal without manual database intervention.
- [x] Implementation follows the published Notion plan.
- [x] `bunx convex codegen`, `bun check`, `bun typecheck`, targeted checkout/webhook/listing/deal tests, `bun run test`, and `bun run review` are accounted for before completion.
  - `bun run test` was run and fails outside ENG-341 scope; see `audit.md`.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit and Convex tests added or updated for checkout validation, session expiry, idempotency, reservation linkage, verified success, late success, duplicate webhook, and failed/abandoned paths.
- [x] Component/route tests added or updated for production listing detail checkout states and redirect/error handling.
- [x] E2E coverage added if a browser-visible mocked Stripe return flow is introduced; otherwise record why targeted component and Convex tests cover the changed workflow.
- [x] Storybook stories are not required unless a reusable UI component contract changes; record justification during validation.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] `bunx convex codegen` passed.
- [x] `bun check` passed.
- [x] `bun typecheck` passed.
- [x] Targeted checkout/webhook/listing/deal tests passed.
- [x] `bun run test` was run with unrelated existing failures recorded.
  - ENG-341 targeted tests passed; full-suite blockers are recorded in `audit.md`.
- [x] `bun run test:e2e` passed or was explicitly justified as not applicable.
- [x] `bun run review` passed.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
