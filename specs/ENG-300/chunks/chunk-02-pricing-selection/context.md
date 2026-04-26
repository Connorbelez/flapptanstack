# Chunk Context: chunk-02-pricing-selection

## Goal
- Add the single source of truth for portal pricing: deterministic policy selection plus a reusable listing projection helper that downstream consumers can import directly.

## Relevant plan excerpts
- `Implement one shared projection helper for portal-facing listing read models; do not duplicate pricing math across queries or UI components.`
- `Prefer read-time projection for portal surfaces over materializing portal-specific listing copies.`
- `Keep the FairLend app portal as a normal first-class pricing consumer, not a pricing bypass.`
- `Do not add a third divergent rounding helper for portal pricing.`

## Implementation notes
- The v1 projected-field list should stay minimal and explicit. Current read models indicate `interestRate` and `monthlyPayment` are the portal-facing return-like fields; structural fields remain canonical.
- Published portals should fail closed when no valid active policy exists. Unpublished portals can return an explicit setup-safe state instead of throwing raw listing data through.
- Export the selector and projection functions from a normal module so `ENG-301` can consume them directly without depending on an endpoint-only API.

## Existing code touchpoints
- `convex/portals/pricing.ts` (new)
- `convex/listings/queries.ts`
- `convex/listings/projection.ts`
- `src/components/lender/listings/LenderListingDetailPage.tsx` as evidence for the currently user-visible listing fields
- GitNexus findings:
  - `listPublishedListings`: `LOW` risk, no direct callers/processes recorded in the current index
  - `getListingWithAvailability`: `LOW` risk, no direct callers/processes recorded in the current index
  - `roundToTwoDecimals` in `convex/listings/queries.ts`: `LOW` risk, direct dependent `buildListingAvailability`

## Validation
- targeted portal-pricing contract tests
- thin listing integration proof test
