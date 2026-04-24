# Chunk Context: chunk-01-route-component-coverage

## Goal
- Add route/component integration tests proving the operator surfaces render backend-driven board, workspace/remediation, final review, and activation states.

## Relevant plan excerpts
- "Add route/component integration tests for the Velocity board, workspace, remediation, final review, and activation-state rendering."
- "Keep UI assertions tied to real backend payloads instead of restating business rules in the test layer."

## Implementation notes
- Use existing `src/test/admin/velocity/final-review.test.tsx` and route-test patterns as references.
- Mock `convex/react` hooks at the component boundary only; fixture shapes should reuse `VelocityBoardRow` and `VelocityWorkspaceDetail` contracts.
- Cover document links, blocker panels, exception/remediation cards, `Sync now`, stale review, failed activation, and retry affordance rendering.

## Existing code touchpoints
- `src/components/admin/velocity/VelocityPackagesIndexPage.tsx`
- `src/components/admin/velocity/VelocityWorkspacePage.tsx`
- `src/components/admin/velocity/VelocityDocumentPanel.tsx`
- `src/components/admin/velocity/VelocityFinalReviewPage.tsx`
- `src/components/admin/velocity/VelocityActivationStatusPanel.tsx`
- `src/components/admin/velocity/types.ts`
- GitNexus impact analysis required before modifying any existing exported component or helper.

## Validation
- `bun test src/test/admin/velocity`
- Broader route/component tests if shared test utilities are modified.
