# Chunk Context: chunk-02-prepare-and-compensate

## Goal
- Implement internal transaction and compensation mutations for checkout preparation and provider failure.

## Relevant plan excerpts
- Create `ledger_reservations` row and `checkoutSessions` row in the same internal mutation with status `preparing_provider_session` and `expiresAt = startedAt + 5 minutes`.
- Validate selected lawyer before creating a reservation.
- Failure paths move checkout to `provider_start_failed`, void reservation, record `failureReason`, and journal rejection.

## Implementation notes
- Use `internal.ledger.mutations.reserveShares` and `voidReservation`; do not duplicate ledger mutation semantics.
- Seller inventory must be canonical ledger account ownership, not MIC regex marketplace availability.
- Query existing active checkout by idempotency before creating a new reservation/session.

## Existing code touchpoints
- `convex/ledger/mutations.ts`: `reserveShares` LOW, `voidReservation` LOW.
- `convex/listings/portalVisibility.ts`: `resolveViewerLenderConstraintForPortal` LOW with 1 direct caller.
- `convex/listings/marketplaceShared.ts`: `buildMarketplaceAvailabilitySummary` LOW but 3 direct dependents/16 total impacted nodes. Reuse for availability only if not selecting seller.
- `convex/schema.ts`: `checkoutSessions` contract is present.

## Validation
- Convex tests for prepare success, rejections, idempotent replay, compensation, and no dangling links.
