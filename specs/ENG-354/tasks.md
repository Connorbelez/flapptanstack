# Tasks: ENG-354 - MIC portal: build admin triage and provisioning workflow

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Gather Linear issue, comments, labels, relations, and linked Notion plan.
- [x] T-002: Read supporting MIC goal, broker portal design, and admin backoffice architecture context.
- [x] T-003: Scaffold execution artifacts and define chunk plan.
- [x] T-004: Run GitNexus index/impact for planned existing symbol edits and record blast radius.
- [x] T-005: Validate execution artifacts at `ready-to-edit`.

## Phase 2: Admin Read Model
- [x] T-110: Create `convex/micInvestorAccessRequests/queries.ts` with admin list filters for portal, status, provisioning state, and requested date.
- [x] T-120: Add admin detail/history query returning request, portal context, review/provisioning metadata, and audit rows.
- [x] T-130: Add Convex tests for pending defaults, status/provisioning/date filters, detail shape, history rows, and non-admin rejection.

## Phase 3: Review Transitions
- [x] T-210: Extend `micInvestorAccessRequestMachine` so approval schedules the MIC provisioning effect.
- [x] T-220: Add `approveRequest` and `rejectRequest` admin mutations in `convex/micInvestorAccessRequests/mutations.ts`.
- [x] T-230: Trim and require non-empty rejection reasons, store review metadata, and log review audit events.
- [x] T-240: Add Convex tests for approval, rejection, invalid state rejection, empty reason rejection, no provisioning on rejection, and non-admin rejection.

## Phase 4: Provisioning Effect
- [x] T-310: Add `convex/micInvestorAccessRequests/internal.ts` with request lookup, provisioning begin/complete/fail helpers, and journal id idempotency.
- [x] T-320: Add `convex/engine/effects/micInvestorAccessRequests.ts` provisioning action using `getWorkosProvisioning()`.
- [x] T-330: Extend WorkOS provisioning types only as needed to capture user and membership ids while preserving existing callers.
- [x] T-340: Register the provisioning effect in `convex/engine/effects/registry.ts`.
- [x] T-350: Add Convex tests for existing user reuse, create-user path, MIC membership role/org, already-member success, provider failure visibility, and retry/idempotency behavior.

## Phase 5: Admin Surface And Validation
- [x] T-410: Add MIC access request entry to `src/components/admin/shell/entity-registry.ts` if generic admin shell exposure is viable.
- [x] T-420: Update Convex test module map if required by new Convex modules before codegen.
- [x] T-430: Run targeted MIC request/provisioning tests and existing onboarding effect tests.
- [x] T-900: Run `bunx convex codegen`.
- [x] T-910: Run `bun check`.
- [x] T-920: Run `bun typecheck`.
- [x] T-930: Run `$linear-pr-spec-audit` and persist verdict to `specs/ENG-354/audit.md`.
- [x] T-940: Resolve audit findings or record blockers and rerun final artifact validation.
