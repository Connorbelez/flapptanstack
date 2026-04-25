# Chunk Context: chunk-01-tests-contract

## Goal
- Add failing backend tests that lock in the ENG-349 handoff contract before production code.

## Relevant plan excerpts
- "Create exactly one deal per checkout session; duplicate retries return existing deal."
- "Deal links reservation, checkout, lock-fee transfer, Stripe refs, lender, and selected lawyer."
- "Existing Deal GT effects must skip/no-op reservation creation when `reservationId` already exists."
- "Package generation failure is persisted/journaled and retryable."

## Implementation notes
- Existing checkout tests live in `convex/checkout/__tests__/start.test.ts`; add focused handoff tests in the checkout test area.
- Use `convex-test` and the existing seed helpers/patterns from checkout and document package tests.
- The first test run must fail because `convex/checkout/dealHandoff.ts` and related contract pieces do not exist yet.

## Existing code touchpoints
- `convex/checkout/reconciliation.ts` currently marks checkout sessions `completed` and links `lockFeeTransferRequestId`; it does not create a deal.
- `convex/schema.ts` has `checkoutSessions.dealId`, but `deals` lacks checkout/Stripe/linkage fields and an idempotency index.
- `convex/deals/mutations.ts::grantDealAccess` is the existing idempotent deal access helper.
- `convex/documents/dealPackages.ts` exposes `runCreateDocumentPackageInternal` for package generation.
- `convex/engine/effects/dealClosing.ts::reserveShares` currently looks for reservation by deal id before creating one.

## Validation
- `bun test convex/checkout/__tests__/dealHandoff.test.ts`: expected to fail before implementation.
- `bun test convex/engine/effects/__tests__/dealLockingFee.test.ts`: may be extended for reservation guard.
