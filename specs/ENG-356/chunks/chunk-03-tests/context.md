# Chunk Context: chunk-03-tests

## Goal
- Prove the MIC query contracts are ledger-derived, fail closed, and avoid unsupported cash/personalized metrics.

## Relevant plan excerpts
- Add convex-test coverage for happy path, missing mapping, unpublished portal, no access, no positions, and multiple active position accounts.

## Implementation notes
- Add `convex/micPortfolio/__tests__/queries.test.ts`.
- Seed a `micinvestor` identity with `mic:access`.
- Seed a MIC portal with `portalType: "mic"` and `micLenderAuthId` pointing at a lender user auth id.
- Use ledger mint/issue helpers to create posted MIC position accounts and unrelated lender positions.
- Assert unrelated lender positions are excluded and query output contains no treasury/reserve/cash/NAV/cap-table fields.

## Existing code touchpoints
- Existing test patterns in `convex/portfolio/__tests__/queries.test.ts`.
- Existing identities and permission helpers in `src/test/auth`.

## Validation
- `bun test convex/micPortfolio/__tests__/queries.test.ts`: not-run
- `bun test convex/portfolio/__tests__/queries.test.ts`: not-run
