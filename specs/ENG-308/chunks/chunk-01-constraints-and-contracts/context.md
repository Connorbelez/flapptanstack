# Chunk Context: chunk-01-constraints-and-contracts

## Goal
- Define the reusable backend contract surface for ENG-308 before the command-center query is assembled.
- Avoid duplicating lender constraint logic by extracting or centralizing the existing portal listing constraint behavior if portfolio suggestions need the same rules.

## Relevant plan excerpts
- "Create a dedicated `convex/portfolio` module that owns lender portfolio DTOs and public query exports."
- "Use `portalLenderQuery` so `portalId` plus auth remains the only public identity contract."
- "Publish explicit DTOs for cockpit metrics, positions rows, payment rows, actions-required items, broker limits, suggested opportunities, and both detail sheets."
- "Suggested opportunities are published as ordered server DTOs. Downstream UI consumers do not rank or score listings in React."

## Implementation notes
- `convex/fluent.ts` already provides `portalLenderQuery` and the portal middleware resolves lender identity through auth plus portal context.
- `convex/listings/portalQueries.ts` already contains lender filter-constraint loading and filter clamping; portfolio suggestions and limits should reuse that behavior instead of reimplementing it independently.
- `convex/ledger/constants.ts` defines the ownership unit system and should remain the canonical source for converting balances into fractions or percent ownership.
- `convex/portfolio/contracts.ts` should hold validators and shared DTO types, while `convex/portfolio/helpers.ts` should hold server composition helpers that are not exported as pseudo-endpoints.

## Existing code touchpoints
- `convex/fluent.ts`
- `convex/portals/middleware.ts`
- `convex/listings/portalQueries.ts`
- `convex/listings/marketplace.ts`
- `convex/ledger/constants.ts`

## Validation
- `bun run test -- convex/listings/__tests__/queries.test.ts` if lender listing constraint extraction changes behavior
- `bun run test -- convex/portfolio/__tests__/queries.test.ts` once the new portfolio tests exist
