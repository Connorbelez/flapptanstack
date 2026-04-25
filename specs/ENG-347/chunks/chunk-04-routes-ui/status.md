# Status: chunk-04-routes-ui

- Result: complete
- Last updated: 2026-04-24 18:27:00 EDT

## Completed tasks
- T-040: `/lawyer` now uses an authenticated parent layout with `Authenticated`, `AuthLoading`, `AppRoutePendingScreen`, and `Outlet` while preserving `guardRouteAccess("lawyer")`.
- T-041: Assigned closings route and grouped queue UI are implemented.
- T-042: Deal workspace route and Matter Overview, Package Review, Signers & Order, Timeline, action controls, and read-only states are implemented.
- T-043: Route/component tests cover queue grouping, workspace panels, action execution, and completed read-only disabled actions; backend/view-model tests cover blocker and access edge states.
- T-044: No matching lawyer Storybook convention exists; route/component tests are the coverage vehicle.

## Validation
- targeted route/component tests: passed via `bun run test -- src/test/lawyer/lawyerWorkspacePages.test.tsx src/test/lawyer/lawyerDealViewModel.test.ts convex/deals/__tests__/lawyerWorkspace.test.ts`
- visual/browser verification: pending final e2e chunk
- `bun check`: passed with existing warning-level diagnostics outside ENG-347 scope
- `bun typecheck`: passed

## Notes
- The workspace tab panels are force-mounted so package, signer, and timeline surfaces stay present in the DOM while Radix controls active visibility.
