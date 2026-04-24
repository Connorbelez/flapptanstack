# Chunk Context: chunk-01-projection-contract

## Goal
- Deliver the canonical backend projection contract and resolver for deal buyer, seller, lawyer, access, persona, contact, and 10,000-based fraction semantics.

## Relevant plan excerpts
- "Create one server-authoritative deal participant, access, persona, contact, and fraction-display projection for deal closing."
- "Keep `dealAccess.role` storage roles as `lender`, `borrower`, `platform_lawyer`, and `guest_lawyer`; map them explicitly to buyer/seller/lawyer portal personas in the projection layer."
- "`fractionalShareUnits` as the raw integer storage value and `fractionalShareDisplayPercent = units / 100`."

## Implementation notes
- New helper module should not export a raw Convex endpoint.
- Projection should resolve `users`, `lenders`, `borrowers`, and active `dealAccess` rows from canonical DB state.
- Invalid fraction units outside `0..10000` must be explicit, not silently reinterpreted.
- Raw `buyerId` and `sellerId` auth strings remain backward-compatible storage fields, not the downstream contract.

## Existing code touchpoints
- Planned new file: `convex/deals/participantProjection.ts`.
- Existing symbols requiring impact/context before edit: `grantDealAccess`, `assertDealAccess`, `canAccessDeal`, `getPortalDealDetail`, `ParticipantSnapshot`, `PackageSurface`.
- Plan-provided GitNexus context says `grantDealAccess` and `assertDealAccess` upstream impact are LOW, with medium product risk because this is a foundational contract.

## Validation
- Pure/unit tests for role mapping, fraction conversion, invalid fraction surfacing, unresolved buyer/seller fallback, and missing lawyer state.
