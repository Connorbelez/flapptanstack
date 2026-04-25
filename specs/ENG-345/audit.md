# Spec Compliance Review: ENG-345

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff against base
- Last run: 2026-04-25T16:13:12-04:00
- Verdict: ready

## Findings
- None.

## Coverage Summary
- SATISFIED: 20
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 0
- OUT_OF_SCOPE: 3

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | data model | Provider expiry attempts and failures are visible to operations. | `convex/schema.ts`, `convex/checkout/mutations.ts` | Persists attempted timestamp, status, and failure reason. |
| SATISFIED | lifecycle | Expiry transitions eligible sessions to `expired`, sets reason/timestamps, and voids linked reservations idempotently. | `convex/checkout/mutations.ts`, `convex/checkout/__tests__/start.test.ts` | Shared release path uses deterministic release idempotency keys and `voidReservationHandler`. |
| SATISFIED | lifecycle | Explicit abandonment transitions to `abandoned`, uses the same release path, enforces owner/admin authorization, and remains idempotent on replay. | `convex/checkout/mutations.ts`, `convex/checkout/actions.ts`, `convex/checkout/__tests__/start.test.ts` | Duplicate abandon does not rerun provider cleanup after final provider success. |
| SATISFIED | lifecycle | Active checkouts are not expired before their internal TTL. | `convex/checkout/mutations.ts`, `convex/checkout/__tests__/start.test.ts` | `expireCheckoutSession` returns the active session when `expiresAt > now`. |
| SATISFIED | scheduling | Sweep active statuses through `by_status_expires_at`, bounded by limit. | `convex/checkout/status.ts`, `convex/checkout/mutations.ts` | Status list is centralized and reused by lookup paths. |
| SATISFIED | scheduling | Sweep retries expired sessions with unfinished provider cleanup. | `convex/checkout/mutations.ts`, `convex/checkout/__tests__/start.test.ts` | Terminal `expired` rows with provider status missing/failed remain eligible until provider cleanup is final. |
| SATISFIED | scheduling | Register a recurring checkout expiry sweep. | `convex/crons.ts` | One-minute interval, limit 50. |
| SATISFIED | provider | Expire Stripe Checkout Sessions when a provider id exists. | `convex/checkout/actions.ts`, `convex/checkout/stripe.ts` | Calls `CheckoutProvider.expireHostedCheckoutSession`. |
| SATISFIED | provider | Provider expiry uses Stripe idempotency keys. | `convex/checkout/actions.ts`, `convex/checkout/stripe.ts`, `convex/checkout/__tests__/stripe.test.ts` | Base key is derived from checkout session id; failed-response retries use an attempt-specific suffix. |
| SATISFIED | provider | Already-expired Stripe sessions are treated as provider cleanup success. | `convex/checkout/stripe.ts`, `convex/checkout/__tests__/stripe.test.ts` | Supports lost-response recovery without downgrading local cleanup. |
| SATISFIED | provider | Provider expiry failure must not block reservation release. | `convex/checkout/actions.ts`, `convex/checkout/__tests__/start.test.ts` | Sweep releases locally before provider cleanup and records failures. |
| SATISFIED | provider | Provider cleanup is skipped when a terminal winner is not cleanup-eligible. | `convex/checkout/actions.ts`, `convex/checkout/__tests__/start.test.ts` | Completed checkout races do not call provider expiry. |
| SATISFIED | provider | Provider cleanup still runs for expired/abandoned sessions with unfinished provider status. | `convex/checkout/actions.ts`, `convex/checkout/__tests__/start.test.ts` | Named eligibility predicate permits `expired` and `abandoned` when provider cleanup is not final. |
| SATISFIED | provider | Stale failed provider records cannot downgrade final success/not-required status. | `convex/checkout/mutations.ts`, `convex/checkout/__tests__/start.test.ts` | `recordProviderExpiryAttempt` preserves final provider status. |
| SATISFIED | provider | Action responses use persisted provider expiry status after record races. | `convex/checkout/actions.ts` | Abandon and sweep provider-config failure paths use the returned mutation status. |
| SATISFIED | retry | Retry inside TTL keeps original `expiresAt` and does not extend TTL. | `convex/checkout/__tests__/start.test.ts` | Existing active session reuse remains tied to original internal checkout session. |
| SATISFIED | integrity | Expired/abandoned sessions are not moved to deal-ready success by this issue. | `convex/checkout/status.ts`, `convex/checkout/__tests__/start.test.ts` | Completed sessions remain untouched by expiry; abandoned has no outgoing transitions. |
| SATISFIED | availability | Availability returns through ledger-derived marketplace availability, not listing counters. | `convex/checkout/__tests__/start.test.ts` | Tests call `buildMarketplaceAvailabilitySummary` after reservation void. |
| SATISFIED | testing | Duplicate replay/idempotency coverage exists. | `convex/checkout/__tests__/start.test.ts`, `convex/checkout/__tests__/stripe.test.ts` | Covers duplicate abandon, stale failed replay, sweep retry, provider idempotency key, and already-expired provider response. |
| SATISFIED | validation | Required commands pass. | `specs/ENG-345/status.md` | `bun check`, `bun typecheck`, `bunx convex codegen`, targeted tests, and `git diff --check` passed. |
| OUT_OF_SCOPE | frontend | E2E browser flow. | Issue scope / `specs/ENG-345/summary.md` | No UI route or control changes in ENG-345. |
| OUT_OF_SCOPE | frontend | Storybook coverage. | Issue scope / `specs/ENG-345/summary.md` | No reusable UI changes in ENG-345. |
| OUT_OF_SCOPE | provider | Live Stripe manual validation. | Issue scope / local test constraints | Provider behavior is covered with mocked Stripe responses. |

## Review Aggregate
- `$linear-pr-spec-audit`: ready; no blocking findings.
- `$pr-review-toolkit`: all actionable findings addressed; final stale sweep response finding fixed after review.
- `$caveman-review`: all actionable findings addressed; final retry idempotency-key finding fixed after review.
- `$gitnexus-pr-review`: GitNexus symbol resolution was unavailable for checkout fluent exports; fallback diff/status/test review was used.
- `$superpowers:requesting-code-review`: all actionable findings addressed, including terminal unfinished provider cleanup retries.

## Unresolved Items
- None.

## Open Questions
- None.
