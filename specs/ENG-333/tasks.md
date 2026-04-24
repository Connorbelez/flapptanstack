# Tasks: ENG-333 - Velocity package: implement reviewed activation orchestration and all-or-nothing handoff

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Finalize implementation task list, chunk plan, and ready-to-edit artifact validation.
- [x] T-002: Run required GitNexus impact checks for existing activation/payment symbols before edits.

## Phase 2: Activation Contracts And Mapper
- [x] T-010: Add focused failing tests for Velocity activation preconditions, reviewed hash validation, and duplicate idempotency.
- [x] T-011: Implement `convex/velocity/activationMapper.ts` to build `VelocityActivationHandoffV1` from reviewed workspace state without defaulting missing remediation fields.
- [x] T-012: Implement activation-attempt start state transition and package audit events in `convex/velocity/activation.ts`.
- [x] T-013: Expose public/internal Velocity activation functions and register new Convex modules for tests/codegen.

## Phase 3: Provider-Safe Handoff
- [x] T-020: Add failing tests proving provider failure leaves no live mortgage.
- [x] T-021: Add a provider-safe finalization seam that calls `activateMortgageAggregate` only after provider success and commits provider-managed collection links in the same DB transaction.
- [x] T-022: Implement Rotessa customer/schedule create-or-reuse orchestration with activation-attempt references and retry-safe failure metadata.
- [x] T-023: Preserve `workflowSourceKey` idempotency and duplicate activation suppression across retries.
- [x] T-024: Implement activation-attempt failure and success transitions with package remediation/audit updates.

## Phase 4: Audit, Drift, And Regression Coverage
- [x] T-030: Add failing tests for post-live Velocity drift producing `live_drift_exception` and `post_live_drift` snapshots.
- [x] T-031: Implement post-live drift detection in the Velocity sync path without mutating canonical mortgage facts.
- [x] T-032: Assert package audit and mortgage audit payloads include Velocity package provenance, reviewer, activation attempt, and created canonical IDs.
- [x] T-033: Run targeted tests after each chunk and update chunk status artifacts.

## Phase 5: Validation
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted Velocity activation regression tests.
- [x] T-904: Run broader `bun run test` if targeted tests pass in a reasonable runtime.
  - Attempted; failed on unrelated existing suites covering listing fixture/schema drift, auth architecture guard offenders, paginate guard, and collection attempt reconciliation auth setup.
- [x] T-910: Run `$linear-pr-spec-audit` against ENG-333 and the current branch diff.
- [x] T-920: Resolve audit findings or record blockers, then rerun artifact final validation.
