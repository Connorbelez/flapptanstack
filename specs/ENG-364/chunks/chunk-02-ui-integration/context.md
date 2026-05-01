# Chunk Context: chunk-02-ui-integration

## Goal
- Render the backend projection and management controls in lender and admin deal views.

## Relevant plan excerpts
- "Show projection in lender/admin deal views before `documentReview.pending`."
- "UI hides or disables impossible actions based on server projection."

## Implementation notes
- Lender view is `src/components/deals/participant/ParticipantDealWorkspacePage.tsx`, reached from `src/routes/lender.deals.$dealId.tsx`.
- Admin view is `src/components/admin/deals/DealOperationsConsole.tsx`, fed by `getAdminDealOperationsDetail`.
- Controls should call server mutations and display server-projected action availability; no client-side authorization decisions.

## Existing code touchpoints
- `src/components/deals/participant/ParticipantDealWorkspacePage.tsx`
- `src/components/admin/deals/DealOperationsConsole.tsx`
- Shared UI may be extracted only if it removes real duplication.

## Validation
- Targeted route/component tests.
- `bun check` for formatting and lint.
