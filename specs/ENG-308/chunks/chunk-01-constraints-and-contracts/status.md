# Status: chunk-01-constraints-and-contracts

- Result: complete
- Last updated: 2026-04-21T19:17:01Z

## Completed tasks
- T-010: Extracted `convex/listings/lenderConstraints.ts` and rewired lender portal listing queries to reuse the shared constraint loader/clamp helpers.
- T-020: Added `convex/portfolio/contracts.ts` with explicit validators and inferred TypeScript contracts for command-center and sheet-detail payloads.
- T-030: Added `convex/portfolio/helpers.ts` to compose cockpit, positions, payment activity, actions, limits, suggestions, and broker coordination payloads from ledger and portal state.

## Validation
- `bun run test -- convex/listings/__tests__/queries.test.ts`: passed
- `bun run test -- convex/portfolio/__tests__/queries.test.ts`: passed

## Notes
- GitNexus impact analysis is complete for the planned `convex/listings/portalQueries.ts` touchpoints and the current blast radius is low.
- This chunk is complete.
