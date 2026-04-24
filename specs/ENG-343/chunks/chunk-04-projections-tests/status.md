# Status: chunk-04-projections-tests

- Result: complete
- Last updated: 2026-04-24T17:59:53-04:00

## Completed tasks
- T-040: Added admin close evidence projection for funds source, archive status, effect outcomes, and blockers.
- T-041: Added participant-safe close receipt summary and included it on portal deal detail.
- T-050: Added focused Convex tests for manual evidence, provider leg 2 evidence, replay, incompatible duplicates, missing evidence, cancelled provider evidence, archive blockers, archive success, and projection visibility.
- T-051: UI e2e and Storybook updates are not applicable; this issue exposes backend contracts and query projections only.

## Validation
- `bun run test convex/deals/__tests__/closeEvidence.test.ts`: passed
- `bun run test convex/deals/__tests__/closeEvidence.test.ts convex/deals/__tests__/effects.test.ts convex/deals/__tests__/dealClosing.test.ts convex/payments/transfers/__tests__/outboundFlow.integration.test.ts`: passed
- `bun run test`: passed

## Notes
- Participant projections intentionally exclude manual admin evidence notes and attachment IDs.
