# Chunk: chunk-04-routes-ui

- [x] T-040: Update `src/routes/lawyer/route.tsx` to use `Authenticated` / `AuthLoading` parent layout pattern while preserving `guardRouteAccess("lawyer")`.
- [x] T-041: Create `src/routes/lawyer/index.tsx` assigned closings route and `LawyerAssignedClosingsPage` with grouped sections, empty/loading/error states, and links to workspace.
- [x] T-042: Create `src/routes/lawyer/deals.$dealId.tsx` workspace route and `LawyerDealWorkspacePage` with Matter Overview, Package Review, Signers & Order, Timeline, action controls, and read-only/access-ended states.
- [x] T-043: Add route/component tests for queue grouping, workspace panels, action disabled/error states, missing-contract blocker states, access revocation while open, package failure, envelope exception, and reissue history.
- [x] T-044: Add Storybook stories for reusable lawyer components if the repo has matching story conventions; otherwise document why route/component tests are the coverage vehicle.

## Notes
- Route/component tests cover queue grouping, workspace panels, action execution, and completed read-only action disablement. Backend/view-model tests cover blocker states, revoked access, package failure, envelope exception, and reissue-history behavior.
- No matching lawyer Storybook convention exists in the repo; route/component tests are the coverage vehicle for this chunk.
