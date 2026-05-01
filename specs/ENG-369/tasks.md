# Tasks: ENG-369 - File Workspace: implement file tree, versioning, upload, retention, and secure URLs

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Gather Linear issue, comments, and Notion implementation plan.
- [x] T-002: Scaffold execution artifacts under `specs/ENG-369`.
- [x] T-003: Validate execution artifacts at `ready-to-edit`.
- [x] T-004: Run GitNexus impact analysis for existing symbols before implementation edits.

## Phase 2: Helpers And Contracts
- [x] T-010: Add pure helper coverage for folder ancestry, sibling collisions, retention eligibility, version allocation, and scan-state URL eligibility.
- [x] T-011: Implement shared File Workspace helper modules for node lookup, trash visibility, version selection, retention checks, and secure URL gating.

## Phase 3: Node Lifecycle
- [x] T-020: Implement authenticated and bearer tree read models with breadcrumbs and descendant-hidden soft delete behavior.
- [x] T-021: Implement create folder, rename, move, soft delete, restore, and retention-gated permanent delete mutations.
- [x] T-022: Add Convex tests for create/rename/move/delete/restore, cross-box rejection, cycle rejection, and sibling uniqueness.

## Phase 4: Uploads And Versions
- [x] T-030: Implement upload URL request and finalize upload flow using Convex storage, policy validation, and pending scan versions.
- [x] T-031: Implement replace-file versioning and restore-old-version-as-new-current.
- [x] T-032: Integrate clean/released scan transitions with current version promotion while keeping old current visible until replacement passes scan.
- [ ] T-033: Add Convex tests for first upload, replacement, stale scan results, version listing permissions, and restore-as-new-current.
  - Replacement and scan promotion are covered; explicit restore-as-new-current coverage remains.

## Phase 5: URLs, Comments, Tags, Events
- [x] T-040: Implement secure preview/download URL queries for authenticated and bearer principals with access, scan, deletion, and download-policy gating.
- [x] T-041: Implement file-scoped comments and box-scoped tags/assignments.
- [ ] T-042: Emit collaboration activity and security events for upload, version, rename, move, comment, tag, delete, restore, preview, download, denial, scan, and retention paths.
  - Core writes are present; bearer listing denial-event coverage remains partial.
- [x] T-043: Add Convex tests for URL gating, public/magic-link read behavior, comments, tags, and event writes.

## Phase 6: Validation
- [x] T-900: Run `bunx convex codegen`.
- [ ] T-901: Run `bun check`.
  - Blocked by pre-existing complexity diagnostics outside this slice.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run `bun run test -- convex/fileWorkspace src/test/convex/fileWorkspace`.
- [ ] T-904: Run `bun run test`.
  - Blocked by pre-existing timeout failures outside this slice.
- [ ] T-905: Run final execution artifact validation.

## Phase 9: Audit
- [x] T-910: Run `$linear-pr-spec-audit`.
- [x] T-920: Resolve audit findings or record blockers.
- [x] T-930: Run `gitnexus_detect_changes` equivalent and confirm affected scope.
