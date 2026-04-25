# Status: chunk-01-contract-schema

- Result: partial
- Last updated: 2026-04-25T00:00:00Z

## Completed tasks
- T-010
- T-011

## Validation
- `CONVEX_DEPLOYMENT=dev:impartial-sturgeon-498 bunx convex codegen`: passed (see `specs/ENG-300/status.md`)
- `bun typecheck`: passed
- `bun check`: blocked on unrelated repo-wide Biome complexity diagnostics (same blocker as the canonical ENG-300 closeout)
- portal-pricing targeted tests: passed (`convex/portals/__tests__/pricing.test.ts` and related files in `specs/ENG-300/status.md`)

Completion here is **partial** until `bun check` is clean (or explicitly scoped out) alongside the other repo-wide gates tracked in `specs/ENG-300/status.md`.

## Notes
- `portalPricingPolicies` now includes `status`, `effectiveFrom`, `effectiveTo`, a required `brokerSplitPercent`, and the indexes needed for deterministic selection.
- `convex/portals/validators.ts` now exports typed status and parameter validators that match the hardened schema contract.
- GitNexus does not model table-field edits directly, so schema safety here is backed by local diff review plus the targeted pricing tests.
