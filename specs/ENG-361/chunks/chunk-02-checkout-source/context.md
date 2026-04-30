# Chunk Context: chunk-02-checkout-source

## Goal
- Make marketplace checkout consume managed active eligible platform lawyer profiles while preserving the existing selected lawyer payload.

## Relevant plan excerpts
- "Do not make checkout depend on a stale listing-local lawyer array when the platform profile source is available."
- "Checkout platform lawyer mode lists the active eligible lawyer."
- "Existing deals and lawyer workspace access must remain compatible with `dealAccess.role = \"platform_lawyer\"` and deals.lawyerId WorkOS auth ID."

## Implementation notes
- Current detail query uses `getMarketplaceClosingLawyers` from `closingTeamAssignments`.
- `ListingDetailPage` already builds selected platform lawyer snapshots using lawyer option id/name/email/firm.
- Add optional detail fields only where needed; keep UI unchanged unless data shape requires a small label/detail update.

## Existing code touchpoints
- `convex/listings/marketplace.ts`: `getMarketplaceClosingLawyers`, detail payload `lawyers`, checkout readiness.
- `src/components/listings/marketplace-detail-adapter.ts`: maps backend lawyers into listing checkout options.
- `src/components/listings/ListingDetailPage.tsx`: `buildSelectedLawyerSnapshot`.
- GitNexus impact pending before editing existing symbols.

## Validation
- Targeted listing detail checkout tests.
- Existing checkout/dealAccess compatibility tests if touched behavior requires it.
