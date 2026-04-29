# Chunk Context: chunk-01-contracts

## Goal
- Expose and adapt the server-owned checkout launcher contract for eligible production listing detail pages.

## Relevant plan excerpts
- "Show production checkout launcher only for production-backed, server-eligible listings."
- "Display CAD 250 lock fee as server-owned copy and do not submit client fee authority."
- "Consumes ENG-340 `StartMarketplaceCheckoutResult`."

## Implementation notes
- Existing backend action is `api.checkout.actions.startMarketplaceCheckout` with `{ listingId, portalId, requestedFractions, selectedLawyer }` and returns `{ ok: true, checkoutSessionId, stripeCheckoutUrl, expiresAt }` or `{ ok: false, code, message }`.
- Existing selected lawyer contract supports `{ type: "platform_lawyer", lawyerId?, name, email, firm? }` and `{ type: "guest_lawyer", name, email, firm? }`.
- Listing detail currently returns `listing.readOnly: true` and no checkout DTO; production eligibility should be server-derived from published listing, `mortgageId`, and availability.

## Existing code touchpoints
- `convex/listings/marketplace.ts`: `getMarketplaceListingDetail`, LOW GitNexus impact.
- `src/components/listings/listing-detail-types.ts`: shared detail DTO types.
- `src/components/listings/marketplace-detail-adapter.ts`: `buildMarketplaceListingDetailModel`, LOW GitNexus impact.
- `src/components/listings/MarketplaceListingDetailPage.tsx`: LOW GitNexus impact.
- `src/components/listings/query-options.ts`: `marketplaceListingDetailQueryOptions`, LOW GitNexus impact with one direct route caller.

## Validation
- `python3 scripts/validate_execution_artifacts.py ENG-350 --repo-root "/Users/connor/.codex/worktrees/ab93/fairlendapp" --stage ready-to-edit`
- `bunx convex codegen` if API output changes.
- Targeted adapter tests after implementation.
