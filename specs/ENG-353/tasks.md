# Tasks: ENG-353 - MIC portal: add public access request intake

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Read Linear issue, comments, labels, relations, and attached Notion implementation plan.
- [x] T-002: Scaffold execution artifacts and chunk directories under `specs/ENG-353/`.
- [x] T-003: Run GitNexus impact analysis for planned existing-symbol edits and record blast radius.
- [x] T-004: Validate execution artifacts at `ready-to-edit` stage.

## Phase 2: Schema And Lifecycle
- [x] T-010: Add `micInvestorAccessRequests` validators in `convex/micInvestorAccessRequests/validators.ts`.
- [x] T-011: Add `micInvestorAccessRequests` table and indexes in `convex/schema.ts`.
- [x] T-012: Add `micInvestorAccessRequestMachine` in `convex/engine/machines/micInvestorAccessRequest.machine.ts`.
- [x] T-013: Register `micInvestorAccessRequest` in engine entity validators, types, table map, and machine registry.
- [x] T-014: Add new Convex modules to `convex/test/moduleMaps.ts`.

## Phase 3: Public Mutation
- [x] T-020: Implement email normalization helper and typed public return contract.
- [x] T-021: Implement active published MIC portal validation using the ENG-352 portal config contract.
- [x] T-022: Implement public unauthenticated `submitPublicRequest` mutation with duplicate pending/approved reuse and rejected resubmission.
- [x] T-023: Write audit journal and audit log rows for actual creation writes.

## Phase 4: Tests
- [x] T-030: Add validator/unit tests for email normalization and status/provisioning literals.
- [x] T-031: Add Convex tests for active MIC creation and unauthenticated public submission.
- [x] T-032: Add Convex tests for duplicate pending/approved behavior and rejected resubmission.
- [x] T-033: Add Convex tests for invalid email and non-MIC/inactive/unpublished/missing-mapping portal failures.
- [x] T-034: Add Convex tests for creation audit journal/log rows.
- [x] T-035: Run onboarding regression tests because the implementation shares audit/entity registration infrastructure.

## Phase 5: Validation And Audit
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted MIC request tests.
- [x] T-904: Run final artifact validation.
- [x] T-910: Run `$linear-pr-spec-audit`.
- [x] T-920: Resolve audit findings or record blockers.
