# Tasks: ENG-348 - Deal closing: ship buyer and seller workspaces

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Gather Linear issue, comments, Notion implementation plan, and supporting architecture docs.
- [x] T-002: Scaffold required execution artifacts under `specs/ENG-348`.
- [x] T-003: Run GitNexus impact for shared symbols before editing.
- [x] T-004: Validate execution artifacts at ready-to-edit stage.

## Phase 2: Backend Projections
- [x] T-010: Inspect landed ENG-338, ENG-342, and ENG-343 helpers and confirm exact projection contracts.
- [x] T-011: Add pure participant workspace view-model helpers for queue grouping, next action, document/signing states, timeline, and receipt state.
- [x] T-012: Add participant queue Convex projection with server-side deal access filtering and persona-specific grouping.
- [x] T-013: Add participant workspace detail Convex projection composing participants, package/envelope state, receipt evidence, property, mortgage, lawyer context, blockers, and timeline.
- [x] T-014: Preserve signable placeholder download rules and token scoping in all participant projections.

## Phase 3: Participant UI And Routes
- [x] T-110: Add buyer/seller authenticated route wrappers and My Closings entry routes.
- [x] T-111: Add shared participant queue UI with Needs Action, In Progress, Completed, and no-active-closing states.
- [x] T-112: Add shared participant workspace UI with Overview, Documents & Signatures, Timeline, Parties & Counsel, blocker states, signing entry, and receipt.
- [x] T-113: Bridge existing lender deal route/detail behavior to the participant workspace without weakening document visibility.
- [x] T-114: Keep buyer/seller copy and next-action semantics role-specific.

## Phase 4: Tests
- [x] T-210: Add Convex tests for authorized queue/detail, unrelated denial, revoked access, signing token visibility, edge states, placeholder visibility, and receipt evidence.
- [x] T-211: Add React component tests for queue grouping, workspace panels, signing availability, edge states, and completed receipt.
- [x] T-212: Add route/integration tests for authenticated wrapper placement and buyer/seller route behavior.
- [ ] T-213: Add e2e coverage for participant happy path, unauthorized denial, and completed receipt.
  - Added Playwright participant route coverage, but runtime execution is blocked until the dev Convex deployment can accept the current schema and expose the new public queries.

## Phase 5: Validation
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted participant query/route/component tests.
- [ ] T-904: Run `bun run test`.
  - Ran; current branch-specific architecture failure was fixed. Remaining failures are pre-existing AMPS demo e2e unit failures in `convex/demo/__tests__/ampsE2e.test.ts`.
- [ ] T-905: Run `bun run test:e2e`.
  - Attempted focused participant e2e. Auth setup passed, but the app route cannot call the new Convex query because `bunx convex dev --once` is blocked by an existing invalid `portals.portalType = "mic"` row in the dev deployment.
- [ ] T-906: Run `bun run review`.

## Phase 9: Audit
- [ ] T-910: Run `$linear-pr-spec-audit` against ENG-348 and the current branch diff.
- [ ] T-920: Resolve audit findings or record blockers.
- [ ] T-930: Run final execution artifact validation with audit and all checklist/tasks closed.
