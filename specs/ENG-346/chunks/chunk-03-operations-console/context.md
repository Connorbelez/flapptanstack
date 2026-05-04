# Chunk Context: chunk-03-operations-console

## Goal
- Replace the generic deal detail route with a dedicated operations console.

## Relevant plan excerpts
- "The console must include lifecycle stage rail, package/envelope/signer status, parties/access state, reservation/locking-fee/funds/proration/reroute/archive outcomes, exceptions/blockers, and audit timeline."
- "Do not expose participant-only embedded signing tokens as admin actions unless specifically intended and access checked server-side."

## Implementation notes
- Current `$recordid` route renders `AdminRecordDetailPage`; route should render `DealOperationsConsole`.
- Existing `DealsDedicatedDetails` has useful package/signable/party/audit UI patterns but lacks the full operations console shape.
- The console should consume the admin operations projection directly rather than `getDealDetailContext`.

## Existing code touchpoints
- `src/routes/admin/deals/$recordid.tsx`
- `src/components/admin/shell/dedicated-detail-panels.tsx` as reference only unless reuse is low-risk.
- New `src/components/admin/deals/DealOperationsConsole.tsx`
- GitNexus impact: `getDealDetailContext` LOW if touched; prefer not to depend on it for the console.

## Validation
- Component/route tests for lifecycle rail, package/signers, parties/access, financials, blockers, audit, missing data, no data, failed, completed.
