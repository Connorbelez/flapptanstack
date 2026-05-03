# Tasks: ENG-371 - File Workspace: add E2E fixtures, full user journeys, and implementation docs

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Gather Linear, Notion, dependency, repo, and GitNexus context.
- [x] T-002: Scaffold execution artifacts and concrete chunk plan.
- [x] T-003: Validate artifacts at `ready-to-edit` stage.

## Phase 2: Fixtures
- [x] T-010: Add `convex/test/fileWorkspaceE2e.ts` deterministic fixture API gated by explicit E2E environment opt-in.
- [x] T-011: Add tests for the File Workspace E2E fixture API.
- [x] T-012: Add `e2e/helpers/file-workspace.ts` with auth, Convex client, upload, seed, wait, assertion, viewport, and cleanup helpers.
- [x] T-013: Fix authenticated read model to expose quarantine scan states while bearer links still hide blocked files.

## Phase 3: Authenticated Workspace E2E
- [x] T-020: Add `e2e/file-workspace/workspace.spec.ts` covering box creation, workspace navigation, folder tree, upload quarantine, clean preview/download, and version replacement.
- [x] T-021: Cover long filenames, deep tree navigation, and mobile/tablet layout checks in the workspace suite.

## Phase 4: Public And Magic Link E2E
- [x] T-030: Add `e2e/file-workspace/public-links.spec.ts` covering public view-only access, no platform navigation, download policy, expired/revoked/tampered links, and neutral inaccessible state.
- [x] T-031: Add public-link security assertions for hidden upload/comment/participant/security/trash/old-version/settings surfaces.

## Phase 5: Security And Retention E2E
- [x] T-040: Add `e2e/file-workspace/security-and-retention.spec.ts` covering manager participant/link management and viewer/editor denied attempts.
- [x] T-041: Cover retention-blocked permanent deletion and visible error state.
- [x] T-042: Cover scan-error release audit behavior proving platform admin success and non-admin denial.

## Phase 6: Documentation
- [x] T-050: Add File Workspace fixture documentation with setup, commands, screenshots, debugging, and test data shape.

## Phase 7: Validation
- [x] T-900: Run `bunx convex codegen`.
- [ ] T-901: Run `bun check`.
  - Failed after in-scope Biome errors were fixed; remaining diagnostics are repo-wide pre-existing complexity findings, first reported file is `convex/admin/origination/collections.ts`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run `bun run test -- convex/fileWorkspace src/test/file-workspace src/test/routes`.
- [ ] T-904: Run `bun run test:e2e -- e2e/file-workspace`.
  - Skipped per user instruction on 2026-05-02.
- [ ] T-905: Run `bun run test`.
  - Blocked by unrelated existing failures in `convex/demo/__tests__/ampsE2e.test.ts` and `src/test/routes/root-route-blocked-hosts.test.ts`.

## Phase 9: Audit
- [x] T-910: Run `$linear-pr-spec-audit`.
- [x] T-920: Resolve audit findings or record blockers.
- [x] T-930: Validate final execution artifacts and run GitNexus change detection.
  - The local GitNexus CLI does not expose `detect_changes`; fallback scope reconciliation used `npx gitnexus status`, `git diff --name-status HEAD`, and `git ls-files --others --exclude-standard`.
