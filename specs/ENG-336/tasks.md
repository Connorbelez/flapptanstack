# Tasks: ENG-336 - Velocity package: deliver board, workspace, and remediation UI

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Finalize implementation task list, chunk plan, and ready-to-edit validation.
- [x] T-002: Run GitNexus impact analysis for existing symbols planned for modification.

## Phase 2: Admin Routing And Authorization
- [x] T-010: Register the Velocity package admin navigation item in `src/components/admin/shell/entity-registry.ts`.
- [x] T-011: Add Velocity route authorization key and admin path mapping in `src/lib/auth.ts`.
- [x] T-012: Add `/admin/velocity` and `/admin/velocity/$workspaceId` handling through the existing typed dynamic admin route surfaces.

## Phase 3: Board
- [x] T-020: Create `VelocityPackagesIndexPage` using the board DTO from `listVelocityPackageWorkspaces`.
- [x] T-021: Render Velocity stage, FairLend action state, readiness blocker count, exception lane, PAD/supporting context, search/filter, and workspace navigation.
- [x] T-022: Keep board rendering passive and backend-driven with no local readiness rules.

## Phase 4: Workspace, Documents, And Remediation
- [x] T-030: Create `VelocityWorkspacePage` using the detail DTO from `getVelocityPackageWorkspace`.
- [x] T-031: Render locked Velocity-owned identity, borrower, property, mortgage, condition, note, and provenance sections.
- [x] T-032: Render editable FairLend-owned bank input, activation remediation fields, staff notes, valuation/listing support fields, and save wiring through `updateVelocityPackageFairLendFields`.
- [x] T-033: Create `VelocityDocumentPanel` and wire PDF upload/link controls through `uploadDocumentAsset`, document asset functions, and `linkVelocityPackageDocument`.
- [x] T-034: Wire `Sync now` to `syncVelocityPackageNow` and show backend result/error state.
- [x] T-035: Render blockers, warnings, exception history, snapshot history, PAD state, and downstream final-review/activation handoff without activation actions.

## Phase 5: Tests
- [x] T-040: Add focused admin Velocity registry coverage, FairLend workspace save-payload coverage, and document the React jsdom component-test blocker.
  - Note: RTL component coverage was attempted, but the new jsdom harness hit an invalid-hook-call failure even when rendering the existing `AdminPageMetadataProvider`; the issue is isolated to the test harness, not the Velocity component logic. DTO/component contracts are covered by `bun typecheck`, route/registry behavior is covered by tests, and retained pure form tests cover save payloads, field clearing, and invalid numeric input.
- [x] T-041: Update route authorization tests for Velocity admin path access.

## Phase 6: Validation
- [x] T-900: Run `bun check`.
- [x] T-901: Run `bun typecheck`.
- [x] T-902: Run `bunx convex codegen`.
- [x] T-903: Run targeted Velocity/admin tests.

## Phase 9: Audit
- [x] T-910: Run `$linear-pr-spec-audit`.
- [x] T-920: Resolve audit findings or record blockers.
  - Residual blocker recorded: manual browser validation is recommended because component interaction tests could not be retained in the local jsdom harness.
