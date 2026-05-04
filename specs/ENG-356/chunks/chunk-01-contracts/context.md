# Chunk Context: chunk-01-contracts

## Goal
- Define typed MIC portfolio query contracts and validators before adding query builders.

## Relevant plan excerpts
- Each response must include `{ generatedAt, sourceOfTruth: "mortgage_ledger_lender_participation", dataCompleteness, warnings }`.
- Do not expose personalized investor holdings or incomplete cash-ledger metrics.

## Implementation notes
- Add `convex/micPortfolio/contracts.ts`.
- Contract should include dashboard snapshot, position rows/detail, payments/history, concentration exposure, maturity ladder, and filter args.
- `dataCompleteness` should be `"partial"` when cash-ledger-backed MIC treasury metrics remain unsupported, while position data can still be ledger-derived.

## Existing code touchpoints
- Follow validator/type style in `convex/portfolio/contracts.ts`.
- Use `convex/values` `v` and `Infer` types.
- No existing symbols should be modified in this chunk.

## Validation
- `bunx convex codegen`: not-run
- `bun typecheck`: not-run
