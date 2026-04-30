# Tasks: ENG-324 - Broker onboarding: ship admin review queue and override workflow

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Finalize implementation task list and chunk plan in `specs/ENG-324`.
- [x] T-002: Run ready-to-edit artifact validation.
- [x] T-003: Run GitNexus impact analysis for existing symbols planned for modification.

## Phase 2: Backend Review API
- [x] T-010: Add backend queue filter validators and review action validators in `convex/onboarding/brokerApplication/validators.ts`.
- [x] T-020: Add admin review queue and dossier projections in `convex/onboarding/brokerApplication/queries.ts`.
- [x] T-030: Add public admin review mutations in `convex/onboarding/brokerApplication/mutations.ts` that call internal command surfaces and require reviewer notes.
- [x] T-040: Tighten internal review command validation in `convex/onboarding/brokerApplication/internal.ts` for approve notes, request-changes note emptiness, reopened fields, and reverification flags.
- [x] T-050: Reconcile onboarding review permission docs if runtime usage requires clarification.
  - No doc change required: runtime wiring uses the existing `onboarding:review` permission plus the established FairLend admin route guard.

## Phase 3: Admin Workspace UI
- [x] T-110: Add route auth wiring for `/admin/broker-onboarding`.
- [x] T-120: Add `BrokerOnboardingReviewPage` split-view workspace.
- [x] T-130: Add queue, dossier, append-only thread, and review action components driven by normalized backend projections.
- [x] T-140: Ensure approval-vs-activation and downstream handoff status are visible in the dossier and action feedback.

## Phase 4: Tests
- [x] T-210: Add backend tests for review permission enforcement, queue filtering, dossier projection shape, reviewer-note requirements, request-changes payload validation, and broker-note ingestion.
- [x] T-220: Add route/component tests for the admin review workspace.
  - Implemented as a route/component source-contract test because the local Vitest React renderer currently has unrelated React singleton failures for hook components.
- [x] T-230: Record why E2E and Storybook coverage are or are not required for this slice.
  - E2E not required for this slice because the server command contracts and route registration are covered; no full browser-auth flow was introduced.
  - Storybook not required because the new page is a composed admin route, not a reusable shared component library surface.

## Phase 9: Validation And Audit
- [x] T-900: Run targeted tests for ENG-324.
- [x] T-901: Run `bunx convex codegen`.
- [ ] T-902: Run `bun check`.
  - Full `bun check` fails on unrelated pre-existing Biome complexity diagnostics outside ENG-324; focused Biome check for ENG-324 files passes.
- [ ] T-903: Run `bun typecheck`.
  - Must pass along with `bun check` and `bunx convex codegen` before validation-gated tasks can be checked off.
- [x] T-910: Run `$linear-pr-spec-audit` and persist the verdict in `specs/ENG-324/audit.md`.
- [x] T-920: Resolve audit findings or record blockers.
  - Audit found no ENG-324 spec gaps. Recorded unrelated full-suite/full-check blockers in `audit.md`.
- [ ] T-930: Run final execution artifact validation.
  - Final validation passes with the global `bun check` baseline blocker recorded.
