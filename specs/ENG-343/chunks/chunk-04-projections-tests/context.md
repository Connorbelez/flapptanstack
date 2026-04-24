# Chunk Context: chunk-04-projections-tests

## Goal
- Expose the close evidence contract to downstream admin and participant consumers and cover the complete behavior with targeted tests.

## Relevant plan excerpts
- Admin/internal deal projections must expose funds source, signed archive status, close effect outcomes, and blocking exceptions.
- Participant-safe close receipt summary must exclude admin-only operational detail while proving close completion.
- Add targeted Convex tests across manual funds evidence, provider leg 2 evidence, duplicate/out-of-order events, missing artifacts, partial retries, cancelled/failed protection, and projection visibility.

## Implementation notes
- Admin projections can include operational blocker detail and manual evidence note.
- Participant-safe receipt should include close completion proof, funds source category, archive status, and timestamps without staff notes or internal exception details.
- E2E and Storybook are likely not applicable unless UI changes are needed.

## Existing code touchpoints
- `convex/deals/queries.ts`
- `convex/deals/__tests__/effects.test.ts`
- `convex/deals/__tests__/dealClosing.test.ts`
- `convex/payments/transfers/__tests__/webhookPipeline.test.ts`
- `convex/payments/transfers/__tests__/outboundFlow.integration.test.ts`

## Validation
- Targeted test suite for touched close, deal, and transfer files.
