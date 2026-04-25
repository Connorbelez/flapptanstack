# Spec Compliance Review: ENG-345

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff against base
- Last run: 2026-04-25T12:18:00-04:00
- Verdict: not ready

## Findings
- [P2] Duplicate public abandonment can overwrite a prior successful provider-expiry record with a later failure. The shared release mutation is idempotent for the local terminal transition and reservation void, but `abandonMarketplaceCheckout` always continues into provider cleanup after `abandonCheckoutSession` returns. If the first abandon succeeds and records `providerExpiryStatus: "succeeded"`, a replay can call Stripe again, fail because the provider session is already expired or unavailable, and `recordProviderExpiryAttempt` can overwrite the operational status to `"failed"`. This is a gap against the terminal-idempotency and abandon/provider-audit requirements. Evidence: `convex/checkout/actions.ts:231`, `convex/checkout/actions.ts:268`, `convex/checkout/mutations.ts:194`, `convex/checkout/mutations.ts:619`.

## Coverage Summary
- SATISFIED: 12
- PARTIAL: 1
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 0
- OUT_OF_SCOPE: 2

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | data model | Provider expiry attempts and failures are visible to operations. | `convex/schema.ts:1265`, `convex/checkout/mutations.ts:668` | Persists attempted timestamp, status, and failure reason. |
| SATISFIED | lifecycle | Expiry transitions eligible sessions to `expired`, sets reason/timestamps, and voids linked reservations idempotently. | `convex/checkout/mutations.ts:194`, `convex/checkout/mutations.ts:599`, `convex/checkout/types.ts:97` | Shared release path uses deterministic release idempotency keys and `voidReservationHandler`. |
| PARTIAL | lifecycle | Explicit abandonment transitions to `abandoned`, uses the same release path, enforces owner/admin authorization, and remains idempotent on replay. | `convex/checkout/mutations.ts:619`, `convex/checkout/actions.ts:231` | Local transition and reservation void are idempotent, but the public action can re-run provider cleanup and overwrite prior successful provider-expiry status on duplicate abandon. |
| SATISFIED | scheduling | Sweep active statuses only through `by_status_expires_at`, bounded by limit. | `convex/checkout/status.ts:25`, `convex/checkout/mutations.ts:645` | Status list is centralized and reused by lookup paths. |
| SATISFIED | scheduling | Register a recurring checkout expiry sweep. | `convex/crons.ts:26`, `convex/crons.ts:77` | One-minute interval, limit 50. |
| SATISFIED | provider | Expire Stripe Checkout Sessions when a provider id exists. | `convex/checkout/actions.ts:75`, `convex/checkout/actions.ts:104` | Calls `CheckoutProvider.expireHostedCheckoutSession`. |
| SATISFIED | provider | Provider expiry failure must not block reservation release. | `convex/checkout/actions.ts:284`, `convex/checkout/__tests__/start.test.ts:814` | Sweep releases locally before provider cleanup and records failures. |
| SATISFIED | retry | Retry inside TTL keeps original `expiresAt` and does not extend TTL. | `convex/checkout/__tests__/start.test.ts:756` | Existing active session reuse remains tied to original internal checkout session. |
| SATISFIED | integrity | Expired/abandoned sessions are not moved to deal-ready success by this issue. | `convex/checkout/status.ts:56`, `convex/checkout/__tests__/start.test.ts:725` | Completed sessions remain untouched by expiry; abandoned has no outgoing transitions. |
| SATISFIED | availability | Availability returns through ledger-derived marketplace availability, not listing counters. | `convex/checkout/__tests__/start.test.ts:695` | Test calls `buildMarketplaceAvailabilitySummary` after reservation void. |
| SATISFIED | testing | Duplicate replay/idempotency coverage exists. | `convex/checkout/__tests__/start.test.ts:672`, `convex/checkout/__tests__/start.test.ts:725` | Covers normal duplicate expiry and terminal repair replay. |
| SATISFIED | testing | Abandon auth coverage exists. | `convex/checkout/__tests__/start.test.ts:859`, `convex/checkout/__tests__/start.test.ts:897` | Owner/admin success and non-owner rejection are covered. |
| SATISFIED | validation | Required commands pass. | `specs/ENG-345/status.md` | `bunx convex codegen`, `bun check`, `bun typecheck`, and targeted tests passed. |
| OUT_OF_SCOPE | frontend | E2E browser flow. | Issue scope / `specs/ENG-345/summary.md` | No UI route or control changes in ENG-345. |
| OUT_OF_SCOPE | frontend | Storybook coverage. | Issue scope / `specs/ENG-345/summary.md` | No reusable UI changes in ENG-345. |

## Unresolved Items
- Make public abandonment provider cleanup replay-safe. A suitable fix is to return the existing `providerExpiryStatus` without another provider call when the released session is already terminal and provider expiry was already `succeeded` or `not_required`, and add a duplicate-abandon test proving the status is not downgraded.

## Open Questions
- None.
