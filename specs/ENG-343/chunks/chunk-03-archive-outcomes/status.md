# Status: chunk-03-archive-outcomes

- Result: complete
- Last updated: 2026-04-24T17:59:53-04:00

## Completed tasks
- T-030: `archiveSignedDocuments` now records completed signed artifacts or a visible missing-artifact archive blocker.
- T-031: Close effect outcomes are recorded for funds confirmation, signed archive, reservation commit, accrual proration, payment reroute, and lawyer access cleanup.
- T-032: Existing idempotency guards for reservation commit, proration, reroute, and lawyer access cleanup are preserved and now reflected in queryable outcomes.

## Validation
- `bun run test convex/deals/__tests__/closeEvidence.test.ts convex/deals/__tests__/effects.test.ts convex/deals/__tests__/dealClosing.test.ts convex/payments/transfers/__tests__/outboundFlow.integration.test.ts`: passed
- `bun run test`: passed

## Notes
- Archive success consumes ENG-342 active completed envelope attempts and generated signed PDF storage IDs; missing attempts/artifacts record blockers.
