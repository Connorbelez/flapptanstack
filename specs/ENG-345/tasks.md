# Tasks: ENG-345 - Checkout: expire abandoned sessions and release reservations

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Finalize implementation task list and chunk plan.
- [x] T-002: Run required GitNexus impact checks for existing symbols before code edits.
- [x] T-003: Validate execution artifacts at `ready-to-edit`.

## Phase 2: Checkout Runtime
- [x] T-010: Add checkout expiry/abandon idempotency-key helpers and active-status sweep helpers.
- [x] T-011: Implement internal expire-one-session mutation with active-status guard, terminal idempotency, provider attempt fields, and `voidReservationHandler`.
- [x] T-012: Implement explicit abandon mutation/action with owner/admin authorization and the same release path.
- [x] T-013: Preserve retry-within-TTL semantics without extending `expiresAt`.

## Phase 3: Provider And Cron
- [x] T-020: Add provider expiry attempt action/helper that calls `CheckoutProvider.expireHostedCheckoutSession` and records success/failure without blocking reservation void.
- [x] T-021: Add bounded sweep action that pages active expired sessions by `by_status_expires_at`.
- [x] T-022: Register a fixed checkout expiry interval in `convex/crons.ts`.

## Phase 4: Tests
- [x] T-030: Add checkout expiry tests for open, retryable, duplicate replay, missing provider id, provider failure, and delayed sweep cases.
- [x] T-031: Add abandon tests for owner success, non-owner rejection, admin/system allowance, and duplicate replay.
- [x] T-032: Add/extend availability assertions showing pending balances are released through `buildMarketplaceAvailabilitySummary`.
- [x] T-033: Add race/idempotency coverage for terminal status conflict, including success-vs-expiry loser behavior available in current checkout contract.

## Phase 5: Validation
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted checkout expiry tests.
- [x] T-904: Run targeted ledger reservation tests if not fully covered by checkout tests.

## Phase 9: Audit
- [x] T-910: Run `$linear-pr-spec-audit` for ENG-345 against the current branch diff.
- [x] T-920: Persist audit verdict to `specs/ENG-345/audit.md`.
- [x] T-930: Resolve audit findings or record blockers.
- [x] T-940: Run final artifact validation with audit and closed checklist/task requirements.
