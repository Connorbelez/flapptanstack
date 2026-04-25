# Tasks: ENG-347 - Deal closing: ship lawyer workspace

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Read Linear issue, comments, attachments, relations, primary Notion plan, and supporting authorization/document/transition docs.
- [x] T-002: Scaffold required execution artifacts with `scripts/init_execution_artifacts.py`.
- [x] T-003: Register/analyze this worktree with GitNexus.
- [x] T-004: Run pre-edit GitNexus impact checks for likely shared symbols and record blast radius.
- [x] T-005: Validate execution artifacts at `ready-to-edit` stage before code edits.

## Phase 2: View Models
- [x] T-010: Create `src/components/lawyer/deals/lawyerDealViewModel.ts` with queue grouping, read-only/access-ended policy, action eligibility, package blocker, signer summary, and timeline helpers.
- [x] T-011: Add focused unit tests for lawyer view-model helper happy paths and edge states.

## Phase 3: Backend Projections
- [x] T-020: Add lawyer-scoped Convex projection module for assigned closings list using `lawyerQuery`, active scoped lawyer access, and ENG-338 participant/fraction projection.
- [x] T-021: Add lawyer-scoped deal workspace projection combining matter overview, package surface, ENG-342 envelope attempts/exceptions, signer roster/order, and timeline.
- [x] T-022: Implement explicit completed/read-only or access-ended policy for revoked/ended lawyer access without weakening active authorization.
- [x] T-023: Add Convex tests for authorized list/detail reads, unrelated denial, non-lawyer denial, revoked-active denial or read-only completion behavior, missing optional participant data, package failure, envelope exception, and reissue history.

## Phase 4: Backend Actions
- [x] T-030: Add lawyer-scoped representation confirmation mutation using `lawyerMutation`, active scoped lawyer access, valid lifecycle-state checks, and governed `REPRESENTATION_CONFIRMED`.
- [x] T-031: Add lawyer-scoped package approval mutation using `lawyerMutation`, active scoped lawyer access, valid lifecycle-state checks, package generation checks, signatory mapping checks, and open pre-send exception checks before governed `LAWYER_APPROVED_DOCUMENTS`.
- [x] T-032: Add Convex tests for valid representation confirmation, invalid state rejection, unauthorized/revoked rejection, valid package approval, and each package approval precondition failure.

## Phase 5: Routes And UI
- [x] T-040: Update `src/routes/lawyer/route.tsx` to use `Authenticated` / `AuthLoading` parent layout pattern while preserving `guardRouteAccess("lawyer")`.
- [x] T-041: Create `src/routes/lawyer/index.tsx` assigned closings route and `LawyerAssignedClosingsPage` with grouped sections, empty/loading/error states, and links to workspace.
- [x] T-042: Create `src/routes/lawyer/deals.$dealId.tsx` workspace route and `LawyerDealWorkspacePage` with Matter Overview, Package Review, Signers & Order, Timeline, action controls, and read-only/access-ended states.
- [x] T-043: Add route/component tests for queue grouping, workspace panels, action disabled/error states, missing-contract blocker states, access revocation while open, package failure, envelope exception, and reissue history.
- [x] T-044: Add Storybook stories for reusable lawyer components if the repo has matching story conventions; otherwise document why route/component tests are the coverage vehicle.

## Phase 6: E2E And Validation
- [x] T-800: Add or update seeded e2e coverage for lawyer queue/workspace, representation confirmation, package approval, and revoked access/read-only behavior.
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted lawyer Convex and route/component tests.
- [x] T-904: Run `bun run test`.
- [ ] T-905: Run `bun run test:e2e`. Blocked/failing outside ENG-347: shared e2e auth/demo suites fail, and the ENG-347 targeted browser spec cannot deploy its Convex seeder until existing dev data with `portals.portalType = "mic"` is migrated or admitted by schema.
- [x] T-906: Run `bun run review`.

## Phase 9: Audit
- [x] T-910: Run `$linear-pr-spec-audit` against ENG-347 and current branch diff.
- [x] T-920: Persist audit verdict in `specs/ENG-347/audit.md`.
- [x] T-930: Resolve audit findings or record blockers, rerun audit if needed, and revalidate final execution artifacts.
