# Audit: ENG-341 - Deal closing from verified listing-lock checkout

- Verdict: ready

## Findings

No ENG-341 implementation gaps remain after the follow-up expiry cron work.

## Coverage Summary

SATISFIED:
- Durable `dealLockCheckoutSessions` table with Stripe/payment/session indexes and deal linkage.
- Checkout start uses authenticated action, server-side listing/mortgage/buyer/lawyer/fraction validation, stable idempotency, Stripe Checkout creation, and temporary ledger reservation before redirect.
- Hosted Stripe Checkout amount is fixed at CAD 250 and webhook processing rejects unexpected checkout amounts.
- Created sessions expire after five minutes. Abandoned sessions are picked up by the bounded `deal lock checkout expiry` cron, which calls the same reservation-voiding expiry path.
- Verified `checkout.session.completed` webhooks preserve signature verification, persist provider events, resolve by Stripe checkout session id, and call success processing.
- Valid in-window success creates exactly one deal, links reservation, records Stripe payment metadata, grants buyer/seller/lawyer access, and emits `DEAL_LOCKED` through the Transition Engine.
- Duplicate, unknown, terminal, and late success events do not create duplicate deals; late success marks refund-needed/refunded state.
- `reserveShares` and `collectLockingFee` reconcile pre-created reservations and externally collected Stripe fees.
- `createDocumentPackage` is scheduled by the existing `DEAL_LOCKED` effect path and remains idempotent through `ensurePackageHeaderInternal`, which uniquely reuses the existing package by `dealId`.
- Marketplace detail exposes checkout only when provider config, available fractions, and closing-team lawyers are present, then redirects to hosted Stripe Checkout.

## Validation Evidence

Passed:
- `bunx convex codegen`
- `bun check` (warnings only in existing unrelated files)
- `bun typecheck`
- `bun run test convex/dealLocks/__tests__/checkout.test.ts`
- `bun run test convex/payments/webhooks/__tests__/stripeWebhook.test.ts`
- `bun run test convex/engine/effects/__tests__/dealLockingFee.test.ts`
- `bun run test src/test/listings/marketplace-listing-detail-page.test.tsx`
- `bun run review` (CodeRabbit: no findings)
- `npx gitnexus status` (index up to date); local CLI has no `detect_changes` command, so final scope reconciliation used `git diff --stat` plus the pre-edit impact checks.

Not passed / not applicable:
- `bun run test` currently fails in unrelated existing test areas: CRM/listing fixtures missing required listing schema fields, auth architecture guard tests, unrelated React hook harness failures, a single paginate guard, and a collection attempt auth test. The ENG-341 targeted tests pass.
- `bun run test:e2e` not run: this change did not introduce a browser-visible mocked Stripe return flow; the changed checkout/webhook behavior is covered by targeted Convex and component tests.

## Residual Risk

The full repository unit suite is not green, but the failures are outside the changed ENG-341 modules and were recorded as validation blockers rather than hidden implementation gaps.
