# Tasks: ENG-332 - Velocity package: ship workspace queries, enrichment, readiness, and document linking

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Gather Linear issue, Notion implementation plan, supporting contract/design docs, and dependency context.
- [x] T-002: Scaffold execution artifacts and chunk directories.
- [x] T-003: Run GitNexus indexing and impact analysis for existing readiness/state helpers.
- [x] T-004: Validate execution artifacts at ready-to-edit stage.

## Phase 2: Workspace Queries And Enrichment
- [x] T-010: Add Velocity workspace DTO assembly for board rows and detail payloads.
- [x] T-011: Add `listVelocityPackageWorkspaces` query with state/exception filters.
- [x] T-012: Add `getVelocityPackageWorkspace` query with immutable Velocity core, mutable enrichment/remediation, readiness, documents, exceptions, and snapshots.
- [x] T-013: Add enrichment/remediation patch mutation that preserves Velocity-owned core facts, recomputes readiness/state, and appends package audit entries.
- [x] T-014: Reuse/export shared readiness state derivation so sync and workspace mutations resolve states consistently.

## Phase 3: Documents, Review, And Exceptions
- [x] T-020: Add document-link mutation that validates existing PDF `documentAssets`, records explicit package roles, supersedes prior active role links, and recomputes readiness.
- [x] T-021: Add final-review confirmation mutation that validates snapshot ownership/hash, persists reviewed snapshot/hash, and recomputes activation readiness.
- [x] T-022: Add exception-resolution mutation that records resolver, resolution timing/details, refreshes workspace exception summary, and appends audit.
- [x] T-023: Export new Velocity workspace modules through the stable Velocity namespace and Convex generated surface.

## Phase 4: Tests
- [x] T-030: Add Convex tests for board/detail query DTO shape and immutable-vs-editable separation.
- [x] T-031: Add Convex tests for enrichment/remediation readiness recomputation and audit entries.
- [x] T-032: Add Convex tests for PAD/supporting document linking, supersession history, and document asset validation.
- [x] T-033: Add Convex tests for final-review hash persistence/invalidation and exception resolution.

## Phase 9: Validation And Audit
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted Velocity Convex tests.
- [x] T-910: Run `$linear-pr-spec-audit`.
- [x] T-920: Resolve audit findings or record blockers.
- [x] T-930: Run final execution artifact validation.
