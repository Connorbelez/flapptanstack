# Chunk Context: chunk-02-participant-ui-routes

## Goal
- Deliver buyer/seller My Closings routes and shared task-first participant workspace UI.

## Relevant plan excerpts
- "Authenticated route trees that render suspense queries must use the `Authenticated` / `AuthLoading` parent layout pattern from `src/routes/listings/route.tsx`."
- "Reuse shared participant components for buyer and seller workspaces while keeping copy, labels, and next-action semantics role-specific."
- "Use compact, task-first UI; this is a work surface, not a landing page."

## Implementation notes
- Lender and borrower route layouts currently only render `<Outlet />`; new suspense query children need the listings-style authenticated wrapper.
- Existing `LenderDealDetailPage` is read-oriented and can provide document visibility precedent, but the participant workspace needs queue grouping, next action, panels, signing state, timeline, and receipt.
- UI must display edge states explicitly without exposing unavailable files or tokens.

## Existing code touchpoints
- `src/routes/listings/route.tsx`: authenticated wrapper reference.
- `src/routes/lender/route.tsx` and `src/routes/borrower/route.tsx`: route layout updates.
- `src/routes/lender.deals.tsx` and `src/routes/lender.deals.$dealId.tsx`: existing lender deal route.
- New shared components expected under `src/components/deals/participant/*`.
- `src/components/lender/deals/LenderDealDetailPage.tsx`: possible bridge/retire behind shared participant component.

## Validation
- React component tests for queue/workspace states.
- Route/integration tests for wrapper placement and query screens.
- Visual/manual browser check if route implementation requires it.
