# Chunk Context: chunk-04-effects-compatibility

## Goal
- Make existing `DEAL_LOCKED` effects safe when checkout already reserved shares and Stripe already collected the lock fee.

## Relevant plan excerpts
- "`DEAL_LOCKED` effects must be compatible with pre-created reservations and externally collected Stripe lock fees; no duplicate reservation, fee transfer, package, access grant, or deal may be created by retries."
- "`reserveShares` and `collectLockingFee` behavior is explicitly tested for pre-created checkout reservations and externally collected Stripe fees."

## Implementation notes
- `convex/engine/effects/dealClosing.ts -> reserveShares` already no-ops when a reservation exists by deal id. It must also respect `deal.reservationId` if the checkout flow linked a pending reservation before the effect runs.
- `convex/engine/effects/dealClosingEffects.ts -> collectLockingFee` currently creates and initiates a manual `locking_fee_collection` transfer for any positive `lockingFeeAmount`. Add a skip/reconcile path when deal metadata indicates Stripe collected the checkout lock fee.
- Preserve existing graceful failure behavior so scheduled effects do not retry-loop on expected skip/reconcile cases.
- Package/access duplication may already be guarded elsewhere; add tests around the retry behavior touched by this issue.

## Existing code touchpoints
- `convex/engine/effects/dealClosing.ts`: `reserveShares`, `voidReservation`, `commitReservation`.
- `convex/engine/effects/dealClosingEffects.ts`: `collectLockingFee`.
- `convex/deals/queries.ts`: `getInternalDeal`, `setReservationId`.
- `convex/engine/effects/__tests__/dealLockingFee.test.ts`: locking fee effect coverage.
- `convex/deals/__tests__/dealClosing.test.ts`: reserve shares effect coverage.
- GitNexus impact: `collectLockingFee` LOW; `reserveShares` exact context found but impact command is name-ambiguous, so treat edits as medium operational risk.

## Validation
- Targeted deal/effects tests proving checkout-linked reservation is not duplicated and Stripe-collected lock fee does not create a manual transfer.
