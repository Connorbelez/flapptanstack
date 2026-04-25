# Summary: ENG-345 - Checkout: expire abandoned sessions and release reservations

- Source issue: https://linear.app/fairlend/issue/ENG-345/checkout-expire-abandoned-sessions-and-release-reservations
- Primary plan: https://www.notion.so/34cfc1b44024815bb5ebcc53909d99fa
- Supporting docs:
  - https://www.notion.so/329fc1b440248106b45ef400bfe497db
  - https://www.notion.so/30ffc1b440248079819bf55c7bcfbe93
  - docs/cash-ledger-developer-guide.md
  - docs/convex/convex-dev-crons.md
  - docs/convex/convex-dev-stripe.md

## Scope
- Implement FairLend-owned checkout expiry for active sessions whose original `expiresAt` is past due.
- Add explicit user abandon behavior with ownership/admin authorization.
- Attempt Stripe hosted Checkout Session expiration when a provider id exists, without blocking local reservation release on provider failure.
- Void linked `ledger_reservations` idempotently so ledger-derived marketplace availability returns through existing availability queries.
- Preserve retry semantics inside the original five-minute TTL and avoid deal creation or success reconciliation changes.
- Add backend tests for expiry, abandon, duplicate/replay behavior, provider failure, retry TTL, and availability release.

## Constraints
- `expiresAt = startedAt + 5 minutes` is internal inventory truth; never extend it for payment failure or retry.
- Sweep active statuses only: `preparing_provider_session`, `hosted_checkout_open`, and `payment_failed_retryable`.
- Terminal transitions must be idempotent and must not move expired/abandoned sessions to deal-ready success in this issue.
- Stripe expiration is cleanup only; provider failure must be recorded but must not leave the ledger reservation pending.
- Do not patch listing availability counters or introduce a second availability source of truth.
- Do not create deals, transfers, refunds, or payment success reconciliation behavior in this issue.
- Every expiry, abandonment, provider-expiry attempt/failure, and reservation void must be audit-visible through checkout fields, ledger journal entries, or deterministic operational metadata.

## Existing Code Touchpoints
- `convex/schema.ts`: `checkoutSessions` already has `by_status_expires_at`; `ledger_reservations` supports pending/committed/voided.
- `convex/checkout/status.ts`: active and terminal checkout statuses already exist.
- `convex/checkout/mutations.ts`: start/attach/provider-start-failed paths already create sessions, enforce TTL, and void failed-provider reservations.
- `convex/checkout/actions.ts`: current hosted checkout start action is the provider-bound entrypoint.
- `convex/checkout/stripe.ts`: provider abstraction already supports `expireHostedCheckoutSession`.
- `convex/crons.ts`: static cron registry exists and is appropriate for fixed checkout expiry sweep cadence.
- `convex/ledger/mutations.ts`: `voidReservationHandler` releases pending balances and posts `SHARES_VOIDED` with idempotency.
- `convex/listings/marketplaceShared.ts`: `buildMarketplaceAvailabilitySummary` derives locked/available fractions from ledger pending balances.

## GitNexus Impact Notes
- `buildMarketplaceAvailabilitySummary`: LOW risk, 3 direct callers, 1 affected process (`listMarketplaceListingsSnapshot`). It should be tested as an observer, not modified unless needed.
- `convex/crons.ts` `crons`: LOW risk, no graph dependents. Adding a new interval job is low structural risk.
- `convex/ledger/mutations.ts` `voidReservation`: graph shows no dependents for the export, but the handler is financially sensitive and used directly by checkout code; implementation risk is medium because mistakes can strand or prematurely release inventory.
- GitNexus could not resolve some fluent-builder exported constants (`attachProviderSession`, `CHECKOUT_ALLOWED_TRANSITIONS`) as targets; local code inspection covers them and edits will remain small.

## Open questions
- none
