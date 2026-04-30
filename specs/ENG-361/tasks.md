# Tasks: ENG-361 - Legal representation: manage platform lawyer profiles and eligibility

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Finalize implementation task list and chunk plan.
- [x] T-002: Run ready-to-edit artifact validation.
- [x] T-003: Run GitNexus impact for existing symbols expected to change.

## Phase 2: Platform Lawyer Backend
- [x] T-010: Add `convex/legalRepresentation/profiles.ts` helpers for normalized profile lookup, uniqueness, platform status updates, and option projection.
- [x] T-011: Add `convex/legalRepresentation/platformLawyers.ts` fluent admin query/mutations and public checkout option query with explicit visibility.
- [x] T-012: Record immutable status-change evidence for profile create/activate/suspend/offboard operations.
- [x] T-013: Add deterministic admin seed path for two active lawyers, one suspended lawyer, and one requires-review lawyer.

## Phase 3: Checkout Source
- [x] T-020: Update marketplace listing detail query to consume active eligible platform lawyer options rather than listing-local closing lawyer assignments when available.
- [x] T-021: Update listing detail adapter/types to preserve platform lawyer profile metadata needed for selected lawyer snapshots.
- [x] T-022: Preserve existing selected platform lawyer payload compatibility.

## Phase 4: Tests
- [x] T-030: Add Convex tests for admin authorization, duplicate auth ID behavior, status changes, audit evidence, and eligibility projection.
- [x] T-031: Add marketplace checkout tests covering active eligible inclusion and suspended/requires-review exclusion.
- [x] T-032: Document why E2E and Storybook are not required if no UI surface changes beyond data sourcing.

## Phase 9: Validation And Audit
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted legalRepresentation and listing checkout tests.
- [x] T-910: Run `$linear-pr-spec-audit`.
- [x] T-920: Resolve audit findings or record blockers.
- [x] T-930: Run final artifact validation and GitNexus change detection.
