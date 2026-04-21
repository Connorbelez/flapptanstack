# Chunk Context: chunk-01-schema-and-contracts

## Goal
- Make the stored snapshot seam and the public history or export contracts deterministic before any write logic lands.
- Ensure the same December 31 business date can hold both a monthly and a year-end snapshot without collisions or ambiguous reads.

## Relevant plan excerpts
- "Implement deterministic monthly and year-end snapshot generation under `convex/portfolio`."
- "The export contract is server-generated and must expose: `isAvailable`, `unavailableReason?`, `filename?`, `csv?`, `generatedAt`, `periodLabel`, and `dataCompleteness`."
- "Client consumers do not assemble CSV rows locally."
- "The cockpit must consume snapshot/live completeness metadata from `ENG-310` instead of inferring it locally."

## Implementation notes
- `convex/schema.ts` already defines `portfolioSnapshots`, but its current indexes only cover `[lenderId, snapshotDate]` and `[snapshotType, snapshotDate]`, which is not enough for deterministic identity when monthly and year-end snapshots share `YYYY-MM-DD = 2026-12-31`.
- `convex/portfolio/contracts.ts` already owns portfolio DTO validators; ENG-310 should extend that module with explicit history and export contracts rather than leaking ad hoc objects from route code.
- `convex/auth/permissionCatalog.ts` already includes `portfolio:export_tax`, so the CSV export read can stay permissioned without inventing a new auth surface.
- `ENG-313` expects a stable upstream export contract and explicit completeness labeling, so contract shape and naming need to settle here before UI wiring starts downstream.

## Existing code touchpoints
- `convex/schema.ts`
- `convex/portfolio/contracts.ts`
- `convex/portfolio/queries.ts`
- `convex/portfolio/helpers.ts`
- `convex/auth/permissionCatalog.ts`

## Validation
- `bunx convex codegen`
- `bun run test -- convex/portfolio/__tests__/queries.test.ts`
