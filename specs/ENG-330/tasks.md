# Tasks: ENG-330 - Velocity package: establish schema, contract, and audit primitives

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Populate execution artifacts from Linear, Notion plan, contract, and design docs.
- [x] T-002: Run ready-to-edit artifact validation.
- [x] T-003: Run GitNexus status/indexing and impact analysis for existing symbols that will be modified.

## Phase 2: Contracts And Validators
- [x] T-010: Create `convex/velocity/constants.ts` with Velocity enum maps, status semantics, workflow constants, and idempotency key builders.
- [x] T-020: Create `convex/velocity/contracts.ts` with raw DTOs, normalized core DTOs, FairLend enrichment/remediation DTOs, readiness/exception types, audit/provenance DTOs, and `VelocityActivationHandoffV1`.
- [x] T-030: Create `convex/velocity/validators.ts` mirroring the reusable contract surface for Convex schema and downstream endpoint reuse.
- [x] T-040: Create `convex/velocity/index.ts` as the stable Velocity namespace export for downstream imports.

## Phase 3: Schema
- [x] T-110: Import Velocity validators into `convex/schema.ts`.
- [x] T-120: Add `velocityPackageWorkspaces` with identity, state, normalized core, enrichment, readiness, review, activation, webhook, sync, and exception indexes.
- [x] T-130: Add `velocityPackageSnapshots`, `velocityWebhookEvents`, `velocitySyncAttempts`, `velocityActivationAttempts`, `velocityPackageExceptions`, and `velocityPackageDocumentLinks` with required relations and indexes.

## Phase 4: Provenance And Audit
- [x] T-205: Add `velocityPackageWorkspace` to the audit journal entity type contract so Velocity package audit rows are first-class.
- [x] T-210: Create `convex/velocity/provenance.ts` with Velocity workflow source constants and canonical mortgage source builders.
- [x] T-220: Create `convex/velocity/audit.ts` with Velocity package audit event contracts and a wrapper around `appendAuditJournalEntry`.
- [x] T-230: Ensure audit helpers preserve webhook agent identity and connector credential scope in structured payloads.

## Phase 5: Tests And Validation
- [x] T-310: Add targeted Velocity tests in `src/test/convex/velocity/contracts.test.ts`.
- [x] T-320: Run targeted Velocity tests.
- [x] T-330: Run `bunx convex codegen`.
- [x] T-340: Run `bun check`.
- [x] T-350: Run `bun typecheck`.
- [x] T-360: Run `$linear-pr-spec-audit` and persist the verdict in `specs/ENG-330/audit.md`.
- [x] T-370: Resolve audit findings or record explicit blockers.
- [x] T-380: Run final execution artifact validation.
- [x] T-390: Run GitNexus change detection before closeout.

## Validation Notes
- `bunx convex codegen`: passed on 2026-04-24.
- `bun check`: passed on 2026-04-24; existing cognitive-complexity warnings remain outside ENG-330.
- `bun typecheck`: passed on 2026-04-24.
- `bun run test src/test/convex/velocity/contracts.test.ts`: passed, 7 tests.
- `bun run test`: failed on unrelated existing suites: auth architecture guard tests, listing fixture/schema drift around `marketplacePropertyType`, CRM system adapter authorization/listing tests, single paginate guard, and one collection-attempt reconciliation admin-role test.
- GitNexus MCP `gitnexus_detect_changes` was not available through tool discovery and the local CLI has no `detect-changes` command; fallback scope verification used `npx gitnexus status` plus local diff/status inspection.
