# Chunk Context: chunk-03-archive-outcomes

## Goal
- Replace signed archive placeholder behavior and make final close effect results visible without duplicating existing idempotent side effects.

## Relevant plan excerpts
- `archiveSignedDocuments` must consume ENG-342 active completed envelope attempt/artifact state.
- Missing artifacts must create a visible exception instead of silent success.
- Preserve idempotency for reservation commit, proration entries, payment reroute creation, and lawyer access revocation.

## Implementation notes
- If ENG-342 artifact rows are unavailable, classify the condition as a missing-artifact blocker.
- Outcome recording should wrap or be called by existing effects in a way that does not change financial/access semantics.
- Do not rewrite reservation/proration/reroute/access logic unless needed for outcome visibility.

## Existing code touchpoints
- `convex/engine/effects/dealClosingEffects.ts`
- `convex/engine/effects/dealClosing.ts`
- `convex/engine/effects/dealClosingProrate.ts`
- `convex/engine/effects/dealClosingPayments.ts`
- `convex/engine/effects/dealAccess.ts`
- ENG-342 modules such as `convex/deals/envelopes.ts` if present.

## Validation
- Tests for missing signed artifacts, archive replay, partial close retry, and no duplicate close-side effects.
