# Tasks: ENG-337 - Velocity package: add mock Velocity harness and backend regression coverage

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Read Linear ENG-337, linked Notion implementation plan, design, and contract.
- [x] T-002: Run GitNexus impact analysis for existing symbols planned for modification.
- [x] T-003: Validate execution artifacts at `ready-to-edit`.

## Phase 2: Mock Harness
- [x] T-010: Add typed mock Velocity scenario contracts, named scenario registry, and deterministic bounded randomization.
- [x] T-011: Add mock full-deal builder output compatible with existing Velocity `VelocityDeal` contracts.
- [x] T-012: Add patch/update helpers for status progression, upstream drift, unsupported enum/frequency, and missing-data cases.
- [x] T-013: Add reusable test helper exports for downstream ENG-335 consumers.

## Phase 3: Dev Endpoints
- [x] T-020: Add Convex/dev helper functions for mock deal storage, scenario creation, webhook emission, mock full-deal fetch/search, and patching.
- [x] T-021: Register HTTP routes for `POST /api/dev/velocity/scenarios`, `POST /api/dev/velocity/webhook`, `GET /api/dev/mock-velocity/v1/deals`, `POST /api/dev/mock-velocity/v1/deals/search`, and `PATCH /api/dev/mock-velocity/deals/:loanCode`.
- [x] T-022: Ensure scenario delivery calls the real Velocity webhook/full-deal processing path rather than direct workspace mutation.

## Phase 4: Regression Coverage
- [x] T-030: Add unit tests for scenario generation, deterministic bounded values, named scenarios, and patch helpers.
- [x] T-031: Add integration tests for webhook idempotency and 1:1 `linkApplicationId` identity using mock scenarios.
- [x] T-032: Add integration tests for readiness gates, final-review invalidation, unsupported payment frequency, missing PAD, and incomplete bank data.
- [x] T-033: Add activation tests proving Rotessa customer/schedule failure creates no live mortgage, retry reuses artifacts, success activates canonically, and post-live drift does not mutate canonical records.
- [x] T-034: Add package query contract coverage where the mock harness exposes workflow payload assumptions for ENG-335.

## Phase 5: Validation And Audit
- [x] T-900: Run targeted Velocity test suite.
- [x] T-901: Run `bunx convex codegen`.
- [x] T-902: Run `bun check`.
- [x] T-903: Run `bun typecheck`.
- [x] T-910: Run `$linear-pr-spec-audit`.
- [x] T-920: Resolve audit findings or record blockers.
- [x] T-930: Run final execution-artifact validation.
