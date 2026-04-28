# Chunk Context: reconciliation and refunds

# Shared ENG-351 Context

Source: Linear ENG-351 - Checkout: end-to-end race, expiry, refund, and audit hardening.

## Summary

Run the final cross-slice hardening pass for marketplace checkout. This is a verification and regression-hardening slice: it stitches the backend, UI, payment, expiry, deal, document, auth, and audit paths into deterministic tests and fixes only defects found inside those contracts.

## Scope

In scope: convex-test integration coverage, race tests, webhook replay tests, expiry/refund tests, deal/document handoff assertions, auth boundary tests, Playwright smoke journey, audit trail assertions, small fixes for defects found by these tests.

Out of scope: new product functionality, redesigned checkout flows, new payment providers, live Documenso implementation beyond existing handoff contract, broad refactors not required by failing tests.

## Required Commands

- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- Targeted checkout/ledger/Stripe/deal/document/listing tests
- `bun run test`
- `bun run test:e2e` when routing/browser coverage is included

## GitNexus Availability Note

Required GitNexus MCP tools were not exposed in this session. The CLI probe `npx gitnexus --help` failed with `Cannot destructure property 'package' of 'node.target' as it is null`. Before implementation edits, retry GitNexus if tools become available; otherwise record this fallback and use focused source/test inspection plus targeted validation.

## Existing Integration Points Observed

- `convex/checkout/actions.ts` exports `startMarketplaceCheckout`.
- `convex/checkout/mutations.ts` owns prepare, attach, provider failure, expiry, abandon, and provider expiry recording.
- `convex/checkout/reconciliation.ts` owns Stripe success/failure, transfer creation, late-success refund path, and webhook status patching.
- `convex/checkout/dealHandoff.ts` owns paid-checkout-to-deal/package handoff.
- `src/components/listings/ListingDetailPage.tsx` owns hosted checkout launcher UI.
- Existing tests include `convex/checkout/__tests__/start.test.ts`, `convex/checkout/__tests__/dealHandoff.test.ts`, `convex/payments/webhooks/__tests__/stripeWebhook.test.ts`, `src/test/listings/listing-detail-checkout.test.tsx`, and marketplace Playwright setup.


## Chunk-Specific Context

Primary code areas: `convex/payments/webhooks/stripe.ts`, `convex/checkout/reconciliation.ts`, `convex/checkout/refunds.ts`, `convex/payments/transfers/mutations.ts`, `convex/payments/transfers/types.ts`. Invariants: persist raw provider events before ACK, trust internal checkout/reservation state over Stripe/client metadata, one valid success creates one `locking_fee_collection`, late success after expiry records refund path and creates no deal-ready state.

## ENG-351 Guardrails

- Do not broaden scope beyond proving and fixing Goal 4 contracts.
- Do not use live Stripe in deterministic tests; use fake/provider boundaries.
- Do not skip auth boundary coverage.
- Do not mark complete if any AC4.x criterion lacks automated coverage or a named manual audit step.
- Run `bun check` before manually fixing lint/format issues.
