# Chunk Context: chunk-03-audit-drift-validation

## Goal
- Complete audit/provenance coverage, post-live drift behavior, quality gates, and final spec audit.

## Relevant plan excerpts
- "Once activated, core borrower/property/loan/payment facts are immutable in FairLend. Later Velocity changes create `live_drift_exception` records and do not mutate the canonical mortgage."
- "Activation provenance should flow into the canonical mortgage audit journal with the Velocity identifiers, package snapshot id, reviewer user id, activation attempt id, and canonical record ids created during activation."
- "Package lifecycle events should flow through the repo's existing append-only audit pipeline."

## Implementation notes
- `applyVelocityFullDealSync` should detect workspace activation and route changed normalized hashes to `post_live_drift` snapshots plus open `live_drift_exception`.
- Drift handling must not patch `normalizedCore` or canonical mortgage facts after activation.
- Mortgage audit can extend the existing `activateMortgageAggregate` payload using Velocity source metadata when `workflowSourceType` is `velocity_package`.
- Final validation must include artifact final validation and `$linear-pr-spec-audit`.

## Existing code touchpoints
- `convex/velocity/sync.ts`: sync mutation that currently updates normalized core on changes.
- `convex/velocity/audit.ts`: package audit append helper.
- `convex/engine/auditJournal.ts`: canonical append-only audit journal.
- `convex/mortgages/activateMortgageAggregate.ts`: mortgage audit payload.

## Validation
- Targeted activation tests cover audit and drift behavior.
- `bunx convex codegen`, `bun check`, `bun typecheck`, targeted tests, and final artifact validation must pass before completion.
