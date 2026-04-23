# Tasks: ENG-316 - Broker onboarding: add brokerOnboardingApplication aggregate and onboardingRequest handoff

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning And Blast Radius
- [x] T-001: Gather Linear, Notion, and repo context and populate the ENG-316 execution artifacts with concrete scope, constraints, and chunking
- [x] T-002: Run GitNexus pre-edit impact checks for the GT registration, entity typing, reconciliation coverage, and onboarding handoff seams expected to change

## Phase 2: Schema And Governed Transition Registration
- [x] T-010: Add `brokerOnboardingApplications` and `brokerOnboardingReviewEntries` to `convex/schema.ts` with lifecycle, resumability, portal, verification, reopened-field, and downstream-linkage fields plus stable lookup indexes
- [x] T-011: Extend governed-entity typing, validators, table mapping, and reconciliation coverage for `brokerOnboardingApplication`
- [x] T-012: Add `convex/engine/machines/brokerOnboardingApplication.machine.ts` and register it in the GT machine registry with the narrow top-level lifecycle

## Phase 3: Aggregate Surfaces And Internal Contracts
- [x] T-020: Add broker-application validators and typed contracts for review entries, reopened-field state, submit payloads, and expiry or handoff metadata
- [x] T-021: Add broker-application mutations for start, draft updates as needed, submit, and append-only broker-note or system-event writes while preserving server-owned lifecycle state
- [x] T-022: Add broker-application queries for resume and read flows keyed by authenticated user and verified email with explicit expiry behavior
- [x] T-023: Add internal helpers for downstream `onboardingRequest` linkage, activation gating, and append-only review-thread persistence

## Phase 4: Tests And Closeout
- [x] T-030: Add focused lifecycle-machine tests for the broker-application GT
- [x] T-031: Add aggregate tests for start, resume, expiry, and review-thread persistence behavior
- [x] T-032: Add handoff-linkage and `activated`-semantics tests around the downstream `onboardingRequest` seam
- [x] T-033: Record why E2E and Storybook coverage are not applicable unless implementation scope expands into route or reusable UI work
- [x] T-900: Run targeted Vitest coverage plus `bunx convex codegen`, `bun check`, and `bun typecheck`
- [x] T-910: Run `$linear-pr-spec-audit` against the current review target and persist the verdict in `audit.md`
- [x] T-920: Resolve audit findings or record blockers, then close the execution artifacts against the final implementation state
