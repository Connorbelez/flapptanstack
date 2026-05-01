# Tasks: ENG-365 - Legal representation: add platform availability, SLA, and restriction rechecks

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Schema And Contracts
- [x] T-001: Finalize implementation task list and chunk plan.
- [x] T-010: Add legal representation availability, exception, SLA tier, SLA review, metric, and escalation validators.
- [x] T-011: Add schema tables and indexes for bounded availability/SLA/recheck operations.
- [x] T-012: Extend platform statuses to include `requires_review` for periodic restriction outcomes.

## Phase 2: Backend Operations
- [x] T-020: Implement availability projection helpers over business days.
- [x] T-021: Implement admin SLA tier configuration and platform lawyer assignment helpers/APIs.
- [x] T-022: Implement admin/lawyer availability management with authorization boundaries.
- [x] T-023: Implement platform lawyer capacity and checkout option projection.
- [x] T-024: Implement SLA timer creation/completion, metric calculation, and idempotent breach escalation.
- [x] T-025: Implement periodic restriction recheck with immutable evidence rows, profile status updates, active-deal escalation, and idempotency.
- [x] T-026: Register bounded cron jobs for SLA breach checks and periodic restriction rechecks.

## Phase 3: Checkout Display
- [x] T-030: Extend listing checkout lawyer option types and adapters to include SLA, availability, active deal count, and capacity warning fields.
- [x] T-031: Update platform lawyer card UI to display the required fields without blocking over-capacity selection.
- [x] T-032: Ensure checkout snapshot creation keeps current legal verification and hold-state checks backend-enforced.

## Phase 4: Tests
- [x] T-040: Add backend tests for availability projection, authorization, SLA tier assignment, and capacity warnings.
- [x] T-041: Add backend tests for SLA breach idempotency and periodic restriction recheck idempotency/evidence.
- [x] T-042: Add checkout component tests for SLA/availability/capacity display and over-capacity warning behavior.
- [x] T-043: Add or justify E2E coverage for checkout/admin workflows.
  - Justification: no new route-level checkout/admin workflow was introduced; changed behavior is covered by Convex domain tests and listing checkout component tests. Existing E2E suite is not required for this backend projection/card-state change.
- [x] T-044: Add or justify Storybook coverage for changed reusable UI states.
  - Justification: the changed card is an internal `ListingDetailPage` subcomponent, not an exported reusable Storybook component; component tests cover the visible SLA, availability, count, and warning state.

## Phase 9: Validation And Audit
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted legalRepresentation and listing checkout tests.
- [x] T-904: Run broader validation commands required by repo scope.
  - Note: full `bun run test` was run; it still has unrelated pre-existing failures in portal, webhook/env, velocity, and cash ledger areas. The ENG-365-specific regression found there was fixed and rerun through targeted listing tests.
- [x] T-910: Run `$linear-pr-spec-audit`.
- [x] T-920: Resolve audit findings or record blockers.
