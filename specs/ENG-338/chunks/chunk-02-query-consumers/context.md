# Chunk Context: chunk-02-query-consumers

## Goal
- Wire existing query/read-model/UI consumers to use the shared projection and display fraction percentages coherently.

## Relevant plan excerpts
- "`getPortalDealDetail` currently returns raw `fractionalShare`, lender/seller names from `buyerId` / `sellerId`, and no lawyer/persona projection."
- "`src/components/lender/deals/LenderDealDetailPage.tsx` displays `fractionalShare` as `bps`."
- "`src/components/admin/deal-card.tsx` displays the same raw field as `%`, proving display drift."

## Implementation notes
- `getPortalDealDetail` must remain server-authorized through `assertDealAccess` or equivalent shared helper.
- Document package code should reuse projection semantics only where it removes duplicated party/contact/fraction logic; do not implement envelope orchestration in this issue.
- UI edits are targeted: render display percent from the backend contract and preserve existing workflows.

## Existing code touchpoints
- `convex/deals/queries.ts`
- `convex/documents/dealPackages.ts`
- `src/components/lender/deals/LenderDealDetailPage.tsx`
- `src/components/admin/deal-card.tsx`
- Tests: `src/test/lender/deal-detail-page.test.tsx`, `src/test/convex/documents/dealPackages.test.ts`

## Validation
- Targeted query/component tests for normalized projection shape and fraction display.
