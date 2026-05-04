# Tasks: ENG-335 - Velocity package: add operator workflow integration and end-to-end coverage

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Gather Linear issue, comments, dependency context, Notion implementation plan, contract, and design.
- [x] T-002: Scaffold ENG-335 execution artifacts and define implementation chunks.
- [x] T-003: Run ready-to-edit artifact validation.
- [x] T-004: Run GitNexus impact analysis for existing symbols before code edits.

## Phase 2: Route And Component Coverage
- [x] T-110: Add board route/component integration coverage for `VelocityPackagesIndexPage`.
- [x] T-120: Add workspace/remediation route/component coverage for `VelocityWorkspacePage`, including backend blockers, document links, and `Sync now`.
- [x] T-130: Extend final-review route/component coverage for activation-state rendering, stale reviewed hashes, and retry/remediation payloads.

## Phase 3: Playwright Helper And Happy Path
- [x] T-210: Add `e2e/helpers/velocity.ts` that wraps ENG-337 scenario creation, Convex auth, package lookup, enrichment/document helpers, final review, activation, and cleanup.
- [x] T-220: Add `e2e/velocity/operator-workflow.spec.ts` for board to workspace to final review to activation progression.
- [x] T-230: Assert the happy path uses backend scenario/query payloads rather than duplicated client-side business rules.

## Phase 4: Negative And Drift Flows
- [x] T-310: Add `e2e/velocity/remediation.spec.ts` coverage for unsupported frequency, missing PAD, incomplete bank/remediation data, and stale reviewed hashes.
- [x] T-320: Add activation failure remediation and retry coverage using the shared harness scenario contracts.
- [x] T-330: Add post-live drift visibility coverage after activation.
- [x] T-340: Add document upload/link and `Sync now` operator journey assertions where the UI exposes those flows.

## Phase 5: Validation
- [x] T-900: Run `bun check`.
- [x] T-910: Run `bun typecheck`.
- [x] T-920: Run `bunx convex codegen`.
- [x] T-930: Run targeted Velocity route/component and e2e tests.
- [x] T-940: Run `$linear-pr-spec-audit` and persist the verdict in `specs/ENG-335/audit.md`.
- [x] T-950: Resolve audit findings or record blockers.
- [x] T-960: Run final execution-artifact validation and GitNexus change detection.
