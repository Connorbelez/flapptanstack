# Chunk Context: chunk-03-late-success-refunds

## Goal
- Implement late-success handling so provider success after invalid terminal FairLend state cannot create deal-ready state and instead records a visible, retryable refund path.

## Relevant plan excerpts
- "A late success after FairLend expiry must refund and must not create deal-ready state."
- "Refund failure is visible and retryable, not swallowed."
- "Do not recognize platform revenue for a lock fee that is refunded because of late success after expiry."

## Implementation notes
- The initial implementation can persist refund intent/completion/failure and expose explicit retry helpers; live Stripe refund API work must remain dependency-injected/testable.
- `expired -> refunded_late_success` is currently the only terminal-to-late-success transition explicitly allowed by `convex/checkout/status.ts`.
- Late success for `abandoned` or other terminal-invalid statuses must not create transfer-confirmed success; if transition legality needs a broader terminal-invalid path, update the status contract intentionally with tests.

## Existing code touchpoints
- New `convex/checkout/refunds.ts`.
- `convex/checkout/status.ts` if transition contract needs to include additional terminal-invalid late-success states.
- `convex/payments/cashLedger/integrations.ts`: `postLockingFeeReceived` and existing refund/suspense intent patterns, for revenue/refund accounting alignment.
- GitNexus impact required before editing `postLockingFeeReceived` or status helpers.

## Validation
- Unit tests for refund decision and retry state.
- Convex tests for late success after expiry/abandonment creating no deal-ready success and recording refund intent/completion/failure.
