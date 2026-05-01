# Chunk Context: chunk-03-checkout-display

## Goal
- Display platform lawyer SLA, availability, active deal count, and capacity warning on marketplace checkout cards.

## Relevant plan excerpts
- "Show platform lawyer card fields: name, firm, SLA tier, availability for next 3-5 business days, active deal count, and capacity warning."
- "Fully booked lawyers remain selectable unless suspended/restricted, but show a capacity warning."

## Implementation notes
- Extend `ListingLawyerOption` with optional SLA/availability/capacity fields.
- Preserve existing checkout snapshot contract; platform lawyer selection sends identity fields, while backend APIs enforce current eligibility.
- UI should warn on over-capacity but keep the card selectable.

## Existing code touchpoints
- `src/components/listings/listing-detail-types.ts`
- `src/components/listings/ListingDetailPage.tsx`
- listing checkout tests under `src/test/listings`
- GitNexus: `buildSelectedLawyerSnapshot` LOW, `ListingDetailPage` LOW.

## Validation
- targeted listing checkout tests
- `bun check`
- `bun typecheck`
