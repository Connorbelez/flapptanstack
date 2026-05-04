# Tasks: ENG-312 - Lender portfolio: ship renewal actions inside the rail and position sheet

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Finalize execution artifacts, issue checklist, and chunk plan for the renewal UI consumer slice
- [x] T-002: Record GitNexus and local dependency blast-radius notes for the existing portfolio host touchpoints

## Phase 2: Runtime Consumer Seam
- [x] T-010: Introduce shared renewal runtime query and mutation consumption for the lender portfolio UI without changing `ENG-309` transition logic
- [x] T-011: Add cache invalidation and stale-refresh handling for command-center and position-sheet renewal state after runtime mutations

## Phase 3: Shared Renewal UI
- [x] T-020: Create shared renewal status and action components under `src/components/lender/portfolio/renewals/`
- [x] T-021: Render renewal-specific action content inside the generic rail item host without taking ownership of the rail shell
- [x] T-022: Render the same governed renewal content inside the position sheet’s Renewal section or tab
- [x] T-023: Keep expired, matured, or sold-out states visible but non-actionable with clear explanations and change-mind affordances only when the runtime allows them

## Phase 4: Tests And Stories
- [x] T-030: Expand renewal fixtures and supporting types for pending, renewed, exiting, expired, and stale-refresh states
- [x] T-031: Add focused renewal UI tests in `src/test/lender/portfolio-renewals.test.tsx`
- [x] T-032: Update affected rail and route tests plus Storybook coverage for shared renewal components

## Phase 5: Validation
- [x] T-900: Run `bunx convex codegen`
- [x] T-901: Run `bun check`
- [x] T-902: Run `bun typecheck`
- [x] T-903: Run targeted renewal UI and touched portfolio test suites

## Phase 9: Audit
- [x] T-910: Run `$linear-pr-spec-audit` against the current branch diff for `ENG-312`
- [x] T-920: Resolve audit findings or record blockers in `specs/ENG-312/audit.md`
- [x] T-930: Run final execution-artifact validation and diff-scope review before closeout
