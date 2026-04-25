# Chunk Context: chunk-03-reservation-package

## Goal
- Complete package generation/repair semantics and duplicate reservation prevention.

## Relevant plan excerpts
- "Generate package from mortgage active private blueprints at deal creation time."
- "Resolve `lender_primary` and `lawyer_primary` from checkout participants."
- "Package generation failure is persisted/journaled and retryable without duplicate deal."
- "If a deal already has `reservationId`, `reserveShares` must be skipped or idempotently no-op."

## Implementation notes
- `runCreateDocumentPackageInternal` already accepts `{ dealId, retry }` and package header logic supports retries.
- `buildParticipantSnapshot` currently resolves lawyer from `closingTeamAssignments`; it must honor deal-scoped selected lawyer data first.
- `reserveShares` should early-return when the deal row already has `reservationId`, optionally linking/checking the existing reservation.

## Existing code touchpoints
- `convex/documents/dealPackages.ts`
- `convex/engine/effects/dealClosing.ts`
- `convex/engine/effects/__tests__/dealLockingFee.test.ts`

## Validation
- Targeted document package and effect tests should pass.
