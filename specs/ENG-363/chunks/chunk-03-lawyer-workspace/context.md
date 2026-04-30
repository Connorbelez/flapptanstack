# Chunk Context: chunk-03-lawyer-workspace

## Goal
- Expose legal gate state in the lawyer workspace and make confirmation action state evidence-aware.

## Relevant Plan Excerpts
- "Update lawyer workspace actions so confirmation is disabled or blocked with clear reasons until evidence preconditions are satisfied."

## Implementation Notes
- Query should return backend-evaluated representation gate status.
- View model should use gate status as a secondary reason for confirmation, while status/read-only checks still apply.
- UI should surface the reason through existing action button disabled reason patterns.

## Existing Code Touchpoints
- `convex/deals/lawyerQueries.ts`
- `src/components/lawyer/deals/lawyerDealViewModel.ts`
- `src/components/lawyer/deals/LawyerDealWorkspacePage.tsx`
- `src/test/lawyer/lawyerDealViewModel.test.ts`
- `src/test/lawyer/lawyerWorkspacePages.test.tsx`

## Validation
- targeted lawyer view-model/component tests
