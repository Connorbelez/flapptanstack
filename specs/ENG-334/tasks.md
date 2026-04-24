# Tasks: ENG-334 - Velocity package: deliver final review and activation UI wiring

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Read Linear issue, Notion implementation plan, contract, and design docs.
- [x] T-002: Scaffold execution artifacts and chunk directories.
- [x] T-003: Run GitNexus impact checks for planned existing symbol touchpoints and record fallback blast radius.
- [x] T-004: Validate artifacts at `ready-to-edit`.

## Phase 2: Backend Detail Contract
- [x] T-110: Extend `getVelocityPackageWorkspace` detail output with latest activation attempt state needed by final review/remediation UI.
- [x] T-120: Preserve account-number redaction while exposing backend-consumed activation preview/provenance fields already present in the detail DTO.
- [x] T-130: Add or update backend detail tests for activation attempt exposure and failed remediation state.

## Phase 3: Final Review UI
- [x] T-210: Create `VelocityFinalReviewPage` to render activation preview, provenance, blockers, stale-review messaging, and action controls from backend DTOs.
- [x] T-220: Create `VelocityActivationStatusPanel` to render in-flight, succeeded, and failed activation attempts with retry/remediation affordances.
- [x] T-230: Add a route-backed final review screen under the admin Velocity workspace flow with existing admin pending/error patterns.
- [x] T-240: Add workspace navigation from `VelocityWorkspacePage` to the final review screen.

## Phase 4: Tests
- [x] T-310: Add component/route tests for exact preview rendering and backend-driven action disabled states.
- [x] T-320: Add tests for stale review hashes and failed activation remediation/retry UI.
- [x] T-330: Document why Storybook and E2E coverage are or are not applicable for this slice.

## Phase 5: Validation And Audit
- [x] T-900: Run `bun check`.
- [x] T-910: Run `bun typecheck`.
- [x] T-920: Run `bunx convex codegen`.
- [x] T-930: Run targeted Velocity/admin UI tests.
- [x] T-940: Run `$linear-pr-spec-audit` and persist verdict in `audit.md`.
- [x] T-950: Resolve audit findings or record blockers.
- [x] T-960: Run final artifact validation and GitNexus change detection.
