# Chunk Context: chunk-02-queries

## Goal
- Implement the MIC-specific read-only Convex query surface from portal mapping and ledger participation.

## Relevant plan excerpts
- Create `convex/micPortfolio/queries.ts` using fluent builder and `.public()`.
- Authorization through authenticated caller plus `mic:access`.
- Base all positions and deal exposure on posted ledger position accounts for the mapped MIC lender.
- Do not infer MIC scope from lender id naming conventions.

## Implementation notes
- Use `authedQuery.use(requirePermission("mic:access"))` or an equivalent fluent chain, then call `resolveMicPortalConfig(ctx, portalId)`.
- Throw `ConvexError` for non-active MIC portal config, missing mapping, or missing mapped lender entity.
- Add a MIC-local helper to read `ledger_accounts` via `by_lender`, keep `type === "POSITION"`, require `mortgageId`, and require posted balance from `getPostedBalance(account) > 0n`.
- Join mortgages, properties, obligations, collection attempts, and transfer requests for rows/history.
- Do not include cash metrics; include warning text that MIC cash-ledger treasury/reserve metrics are unavailable until complete ledger coverage exists.

## Existing code touchpoints
- `convex/portals/micConfig.ts`: use `resolveMicPortalConfig`; impact check required before modifying, but intended use is import-only.
- `convex/fluent.ts`: use existing builders/middleware; do not modify `PortalBuilder`.
- `convex/ledger/accounts.ts`: use `getPostedBalance`; import-only.
- `convex/test/moduleMaps.ts`: likely requires additive entries for new module files.

## Validation
- `bunx convex codegen`: not-run
- Targeted MIC portfolio tests: not-run
