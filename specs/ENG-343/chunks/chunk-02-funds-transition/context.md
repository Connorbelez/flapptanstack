# Chunk Context: chunk-02-funds-transition

## Goal
- Replace funds receipt stub behavior with audited provider/manual evidence paths that still respect the governed deal transition machine.

## Relevant plan excerpts
- Provider-backed confirmation must verify a completed leg 2 seller payout for the same deal.
- Manual confirmation must require FairLend staff admin authority, actor, received timestamp, evidence note, and optional attachments.
- Missing, mismatched, incompatible duplicate, cancelled, failed, or non-funding evidence must reject or safely exception `FUNDS_RECEIVED`.

## Implementation notes
- Prefer resolving deterministic provider evidence by deal/pipeline if the event payload does not already carry the full evidence source.
- Manual admin flow should emit `FUNDS_RECEIVED` through the transition engine, never patch deal status.
- Exact replay should no-op or return existing evidence; incompatible replay should record a visible blocker/exception.

## Existing code touchpoints
- `convex/engine/effects/dealClosingEffects.ts`
- `convex/engine/effects/transfer.ts`
- `convex/payments/transfers/mutations.ts`
- `convex/deals/mutations.ts`
- `convex/engine/machines/deal.machine.ts`

## Validation
- Targeted Convex tests for valid manual evidence, missing manual evidence, valid provider evidence, duplicate provider event, late provider event, and cancelled/failed protection.
