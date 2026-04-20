# Status: chunk-01-contract-schema

- Result: complete
- Last updated: 2026-04-20T21:10:58Z

## Completed tasks
- T-010
- T-011

## Validation
- `bunx convex codegen`: blocked by missing `CONVEX_DEPLOYMENT`
- portal-pricing targeted tests: passed

## Notes
- `portalPricingPolicies` now includes `status`, `effectiveFrom`, `effectiveTo`, a required `brokerSplitPercent`, and the indexes needed for deterministic selection.
- `convex/portals/validators.ts` now exports typed status and parameter validators that match the hardened schema contract.
- GitNexus does not model table-field edits directly, so schema safety here is backed by local diff review plus the targeted pricing tests.
