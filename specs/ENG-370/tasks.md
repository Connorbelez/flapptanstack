# Tasks: ENG-370 - File Workspace: build files routes, shared file tree, workspace UI, and public link view

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Gather Linear issue, comments, Notion implementation plan, supporting goal spec, and repository route/UI/backend contract context.
- [x] T-002: Run ready-to-edit artifact validation after chunk artifacts are populated.
- [x] T-003: Run GitNexus impact checks for existing symbols touched by route/auth/UI integration.

## Phase 2: Routes And Query Contracts
- [x] T-010: Add `src/components/file-workspace/types.ts` and `query-options.ts` around existing Convex APIs.
- [x] T-011: Add `/files` parent route with `Authenticated` / `AuthLoading` and `/files` index route loader/component.
- [x] T-012: Add `/files/$boxId` authenticated workspace route.
- [x] T-013: Add `/files/public/$token` unauthenticated public route.
- [x] T-014: Add route tests for authenticated gating and public route no-auth behavior.

## Phase 3: Shared File Tree
- [x] T-110: Build reusable `FileTree` controlled component with loading, disabled, trashed, drag-target, indentation, and selected state support.
- [x] T-111: Add keyboard navigation coverage for expand/collapse, next/previous item, Enter selection, and touch-friendly button targets.

## Phase 4: Authenticated Workspace UI
- [x] T-210: Build `BoxIndexPage` with owned/shared/public-link-enabled/archived filters, role/status badges, last activity, and create-box action.
- [x] T-220: Build `WorkspacePage` with left rail, search/tree/trash, top breadcrumbs/actions/view toggle, main table/list, and responsive split/collapsed behavior.
- [x] T-230: Build `FileInspector` with details, comments, versions, activity, access, scan, retention, and link state tabs without nested cards.
- [x] T-240: Build `ShareSettings` for participants, links, policies, retention, and security activity where backend read models allow.
- [x] T-250: Build `UploadControls` for upload, create folder, share, and manager actions with capability-based visibility.
- [x] T-260: Add React tests for filters, action visibility, inspector tabs, scan/retention/link states, long filenames, loading, and empty states.

## Phase 5: Public View And Responsive States
- [x] T-310: Build `PublicFileViewPage` with branded view-only file list/preview, inaccessible states, and download visibility rules.
- [x] T-320: Add tests for public clean, download-disabled, expired/revoked/malformed, and scan-blocked states.
- [x] T-330: Verify responsive desktop/tablet/mobile behavior in component tests or browser checks where practical.

## Phase 6: Validation
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`. Exits 0 with existing unrelated complexity warnings.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run `bun run test -- src/test/file-workspace src/test/routes`.
- [x] T-904: Run broader `bun run test` because shared route/auth primitives changed.

## Phase 9: Audit
- [x] T-910: Run `$linear-pr-spec-audit` against ENG-370 and the current branch diff.
- [x] T-920: Resolve audit findings or record blockers.
- [x] T-930: Run final execution artifact validation with audit and closed checklist/task requirements.
- [x] T-940: Run GitNexus detect changes before wrap-up; CLI has no `detect-changes` subcommand, so final scope was verified with `gitnexus status` plus changed-file diff.
