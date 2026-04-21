# Chunk Context: chunk-02-command-center-query

## Goal
- Build the main lender portfolio command-center read that returns all page-section DTOs in one empty-state-safe payload.
- Make the backend source-of-truth explicit so downstream route and UI slices consume the portfolio contract instead of reconstructing it.

## Relevant plan excerpts
- "This issue owns the portfolio DTO layer under `convex/portfolio` and publishes stable lender-facing reads for the cockpit, positions ledger, payment activity ledger, actions-required feed, broker limits strip, detail sheets, suggested opportunities, and broker coordination context."
- "Payment activity is row-level and lists individual payments. Downstream UI must not collapse this into aggregate-only summaries."
- "Broker-imposed limits stay server-owned and should be consumable by both the lower limits strip and the suggestions section."
- "Command-center reads must be empty-state-safe and return stable shapes even when the lender has zero active positions."

## Implementation notes
- Reuse `getLenderPositions`, `getPositions`, `getBalanceAt`, `buildPortfolioAccrualBreakdown`, dispersal queries/helpers, and lender portal listing seams as composition inputs rather than exposing those raw seams directly to the client.
- Suggested opportunities should be computed from already-published portal listings while excluding mortgages the lender already holds and preserving ordered DTO semantics.
- Payment activity rows should key off individual obligations and attach the latest collection or settlement context where available.
- The main query should expose section-level DTOs for cockpit, positions, payments, actions required, limits, suggestions, and broker coordination in a stable top-level object.

## Existing code touchpoints
- `convex/ledger/queries.ts`
- `convex/accrual/queryHelpers.ts`
- `convex/dispersal/queries.ts`
- `convex/listings/marketplace.ts`
- `convex/listings/portalQueries.ts`
- `convex/auth/resourceChecks.ts`

## Validation
- `bun run test -- convex/portfolio/__tests__/queries.test.ts`
- `bun run test -- convex/accrual/__tests__/queryHelpers.test.ts convex/ledger/__tests__/queries.test.ts`
