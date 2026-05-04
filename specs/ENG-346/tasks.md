# Tasks: ENG-346 - Deal closing: upgrade admin operations console

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Read Linear issue, comments, attachments, and managed Requirements / Definition of Done.
- [x] T-002: Read Notion implementation plan and directly constraining architecture/upstream contract docs.
- [x] T-003: Confirm current repository state for upstream ENG-338/342/343 contracts and admin deal routes.
- [x] T-004: Scaffold and populate execution artifacts under `specs/ENG-346/`.
- [x] T-005: Run GitNexus index/status and upstream impact checks for planned existing symbol edits.
- [x] T-006: Validate execution artifacts at `ready-to-edit` stage.

## Phase 2: Admin Projection And View Model
- [x] T-110: Add `convex/deals/queries.ts` admin operations projection for pipeline cards and console details using participant, package/signing, close evidence, blocker, access, and audit data.
- [x] T-120: Add pure `src/components/admin/deals/dealOperationsViewModel.ts` helpers for phases, filters, blockers, valid actions, lifecycle rail, and display formatting.
- [x] T-130: Add targeted projection/view-model tests for filter buckets, missing-contract states, action gating, and blocker summaries.
  - Completed: view-model tests cover phase grouping, filters, blocker summaries, action labels, and share/enum display.
  - Completed: Convex admin projection tests cover missing mortgage visibility, unknown upstream status handling, and server-projected governed actions.

## Phase 3: Pipeline
- [x] T-210: Create `DealOperationsPipeline` and card components under `src/components/admin/deals/`.
- [x] T-220: Wire `/admin/deals` to the operations pipeline while preserving child outlet behavior.
- [x] T-230: Implement filters for needs action, blocked, awaiting signatures, awaiting funds, completed, and failed.
- [x] T-240: Ensure card actions collect required payloads, require cancellation reason, and use governed mutations only.

## Phase 4: Operations Console
- [x] T-310: Create `DealOperationsConsole` with lifecycle, package/signers, parties/access, financials, blockers/exceptions, actions, and audit panels.
- [x] T-320: Wire `/admin/deals/$recordid` to the dedicated console while preserving admin shell route context.
- [x] T-330: Render loading, no-data, blocked, failed, completed, missing optional data, and missing upstream-contract states without crashes.
- [x] T-340: Keep participant-only signing tokens out of admin panels.

## Phase 5: Coverage
- [x] T-410: Add or update React Testing Library coverage for pipeline filters/cards, console panels, payload dialogs, invalid action disabled states, and partial data.
- [x] T-420: Add or update e2e coverage for admin opening pipeline, filtering, opening a deal console, cancellation reason flow, blocker/exception states, and denial paths.
  - Completed: existing deal-closing e2e spec was updated for the new operations pipeline/console markup and cancellation dialog.
  - Blocked: e2e execution requires `TEST_ACCOUNT_EMAIL`, which is absent in this environment.
- [x] T-430: Record Storybook decision or add stories if a new reusable component warrants them.
  - Decision: no Storybook story was added because the new components are route-coupled admin screens driven by Convex query projections rather than reusable library components.

## Phase 9: Validation And Audit
- [x] T-900: Run `bunx convex codegen`.
  - Passed: `CONVEX_DEPLOYMENT=dev:impartial-sturgeon-498 bunx convex codegen` passed after preserving canonical document variable literal key types.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
  - Passed after preserving canonical document variable literal key types.
- [x] T-903: Run targeted tests for touched query/view-model/component/e2e scope.
- [ ] T-904: Run `bun run test`.
  - Blocked: full suite has unrelated existing failures; the new ENG-346 focused tests pass.
- [ ] T-905: Run `bun run test:e2e` or record explicit environment blocker.
  - Blocked: `bun run test:e2e -- --project=deal-closing` requires `TEST_ACCOUNT_EMAIL`.
- [ ] T-906: Run `bun run review`.
  - Blocked: CodeRabbit exits before review because the branch/worktree contains 792 files, over its 300-file limit.
- [x] T-910: Run `$linear-pr-spec-audit`.
- [x] T-920: Resolve audit findings or record blockers.
- [x] T-930: Run final execution artifact validation and GitNexus change detection.
  - Final artifact validation passed with `--require-audit`.
  - GitNexus CLI does not expose `detect_changes`; fallback scope check used `npx gitnexus status` plus git diff/status inspection.
