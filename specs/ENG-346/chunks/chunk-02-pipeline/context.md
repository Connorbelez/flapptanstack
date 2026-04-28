# Chunk Context: chunk-02-pipeline

## Goal
- Make `/admin/deals` open to an operations pipeline with filters, compact cards, valid action affordances, and reactive counts.

## Relevant plan excerpts
- "Replace the default `/admin/deals` experience with a phase-grouped operating pipeline that updates reactively and supports filters for needs action, blocked, awaiting signatures, awaiting funds, completed, and failed."
- "Cards must display server-projected lifecycle phase/sub-state, next valid action summary, blocker summary, normalized buyer/seller/lawyer labels, closing team assignment state, and fraction display percent."

## Implementation notes
- Current route renders `AdminEntityViewPage`; replace default branch with `DealOperationsPipeline` while preserving `<Outlet />` for child record route.
- Existing `KanbanDealsBoard` and `DealCard` are a useful reference but still show raw participant ids and old share text in places.
- Action controls must not submit payload-required events without payload. Existing manual funds and cancellation paths can be reused or moved.

## Existing code touchpoints
- `src/routes/admin/deals/route.tsx`
- `src/components/admin/kanban-deals.tsx`
- `src/components/admin/deal-card.tsx`
- `src/hooks/useDealActions.ts`
- New `src/components/admin/deals/DealOperationsPipeline.tsx`
- GitNexus impact: `KanbanDealsBoard` LOW; `DealCard` LOW; `useDealActions` LOW with direct caller `DealCard`.

## Validation
- React tests for filters, cards, blocker summaries, action visibility, cancellation reason, and manual funds dialog.
- Existing e2e `e2e/deal-closing/kanban.spec.ts` must be updated for 10,000-unit display percent and new console/pipeline semantics.
