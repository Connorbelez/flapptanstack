# Tasks: ENG-309 - Lender portfolio: register lender renewal intent in the transition engine

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning And Blast Radius
- [x] T-001: Gather Linear and Notion context, confirm the runtime scope, and refresh execution artifacts for ENG-309
- [x] T-002: Run GitNexus analyze plus pre-edit impact checks for `executeTransition`, `machineRegistry`, and `reconcile`

## Phase 2: Engine Runtime
- [x] T-010: Extend the governed entity/type surface for `lenderRenewalIntent` and add any shared renewal transition constants or validation helpers required by the machine
- [x] T-011: Create `convex/engine/machines/lenderRenewalIntent.machine.ts` and register it in `convex/engine/machines/registry.ts`
- [x] T-012: Update reconciliation coverage and any required engine lookup seams so governed lender renewal intents are no longer skipped while leaving `executeTransition` semantics unchanged

## Phase 3: Portal Surface And Scheduling
- [x] T-020: Add a thin portal-safe lender renewal read/signal/change-intent module guarded by `withPortalLender` plus `portfolio:signal_renewal`
- [x] T-021: Implement idempotent internal creation and expiry entrypoints for the 180-day creation window and 60-day deadline behavior using existing mortgage and ledger seams
- [x] T-022: Register renewal creation and expiry scheduling in `convex/crons.ts` and keep reruns safe for already-created or already-transitioned intents

## Phase 4: Tests And Validation
- [x] T-030: Add machine and registry tests covering lender renewal intent states, transitions, and registration completeness
- [x] T-031: Add transition, portal renewal, and scheduler tests covering auth rejection, invalid partial exits, change-mind flows, create-window idempotency, and expiry behavior
- [x] T-900: Run targeted renewal, engine, and portal test coverage for ENG-309
- [x] T-910: Run `bunx convex codegen`, `bun check`, and `bun typecheck`

## Phase 9: Audit
- [x] T-920: Run `$linear-pr-spec-audit`, resolve findings or record blockers, and reconcile final scope against GitNexus plus `git diff`
