# Tasks: ENG-331 - Velocity package: build webhook ingestion and full-deal sync spine

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Finalize implementation task list, chunk plan, and ready-to-edit artifact validation.
- [x] T-002: Run GitNexus impact analysis for existing symbols expected to change before implementation edits.

## Phase 2: Webhook Ingress
- [x] T-010: Register `POST /api/velocity/webhook` in `convex/http.ts`.
- [x] T-011: Create `convex/velocity/webhook.ts` with authenticated HTTP handling, payload parsing, unauthorized/invalid responses, and event extraction.
- [x] T-012: Persist raw webhook events with idempotency key, webhook agent, connector credential context, raw body, event status, and deal href before sync processing.
- [x] T-013: Wire webhook processing to the shared full-deal sync path without mutating workspace state from webhook payload fields.

## Phase 3: Full-Deal Client And Normalization
- [x] T-020: Create `convex/velocity/client.ts` for Deals Out fetch by `loanCode`, response validation, credential provenance, and opaque href fallback.
- [x] T-021: Create shared sync request/result types and dependency-injection seams so tests can run without real Newton network calls.
- [x] T-022: Implement full-deal normalization into `VelocityNormalizedCoreV1`, stable raw/normalized hashes, enum mappings, and required-core-field blockers.
- [x] T-023: Implement readiness derivation for v1 status semantics, unsupported payment mappings, missing FairLend-owned fields, and post-review drift detection inputs.

## Phase 4: Workspace Upsert, Snapshots, Exceptions, Manual Sync
- [x] T-030: Implement idempotent workspace lookup/create/update by `linkApplicationId` and collision detection.
- [x] T-031: Implement snapshot creation only when upstream normalized core hash changes and duplicate-noop behavior for repeated full-deal hashes.
- [x] T-032: Implement package exception open/supersede behavior for identity, sync, mapping, and required-core-field failures with webhook/sync provenance.
- [x] T-033: Write ingress and sync lifecycle audit entries via `appendVelocityPackageAuditEntry`.
- [x] T-034: Expose manual `Sync now` through a fluent Convex action/mutation surface that reuses the shared sync path.

## Phase 5: Tests
- [x] T-040: Add `src/test/convex/velocity/sync.test.ts` coverage for webhook idempotency and raw event persistence.
- [x] T-041: Add tests for full-deal normalization, missing/colliding `linkApplicationId`, readiness blockers, and package exceptions.
- [x] T-042: Add tests for snapshot idempotency and manual-sync/webhook convergence.

## Phase 9: Validation And Audit
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted Velocity tests.
- [x] T-910: Run `$linear-pr-spec-audit`.
- [x] T-920: Resolve audit findings or record blockers.
- [x] T-930: Run final execution-artifact validation with audit and closed checklist/task requirements.

## Validation Notes
- T-901 passed after baselining Biome's diagnostic display cap with `--max-diagnostics=300`; existing warning-level diagnostics remain visible.
- T-920 recorded the audit update in `specs/ENG-331/audit.md`: implementation requirements are satisfied, with only deployment/provider manual validation remaining.
