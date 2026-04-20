# Status: chunk-02-pricing-selection

- Result: complete
- Last updated: 2026-04-20T21:10:58Z

## Completed tasks
- T-020
- T-021
- T-022

## Validation
- portal-pricing targeted tests: passed
- listing integration proof test: passed

## Notes
- `convex/portals/pricing.ts` now owns policy validation, active-policy selection, published-vs-unpublished behavior, and the importable projection helper.
- The pricing math now reuses `convex/listings/math.ts` so portal pricing does not introduce a third divergent rounder.
- `loadPortalPricingSelection` and `requirePortalPricingSelection` provide the importable seam that `ENG-301` can consume without reopening the pricing contract.
