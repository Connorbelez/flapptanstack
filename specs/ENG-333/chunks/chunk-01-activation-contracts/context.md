# Chunk Context: chunk-01-activation-contracts

## Goal
- Deliver the reviewed package activation contract, mapper, attempt lifecycle, and first backend tests without touching provider external-call ordering yet.

## Relevant plan excerpts
- "Activation is allowed only when: Workspace state is `ready_to_activate`; current Velocity status is exactly `6`; `finalReview.reviewedSnapshotHash === normalizedCoreHash`; no open blocking exception exists; bank data exists; PAD PDF exists; required canonical activation fields exist; payment frequency mapping is supported; no canonical mortgage exists for `workflowSourceKey`."
- "Required canonical activation inputs that Velocity does not expose or cannot map deterministically are package-owned FairLend remediation inputs in v1."
- "workflowSourceKey: `velocity_package:mortgage:<linkApplicationId>`."

## Implementation notes
- Tests must be written first in `src/test/convex/velocity/activation.test.ts`.
- `convex/velocity/activationMapper.ts` should be pure where possible and should throw `ConvexError` for missing required handoff fields.
- `convex/velocity/activation.ts` should use fluent-convex exports with explicit `.public()` or `.internal()`.
- Attempt idempotency key is `velocity:activation:<workspaceId>:<reviewedSnapshotHash>`.
- Activation start must patch workspace state to `activating` and append package audit entries.

## Existing code touchpoints
- `convex/velocity/contracts.ts`: already defines `VelocityActivationHandoffV1` and activation attempt record shape.
- `convex/velocity/constants.ts`: already defines Velocity source constants and activation idempotency/workflow source key builders.
- `convex/velocity/workspaces.ts`: final review and readiness reference implementation.
- `convex/velocity/sync.ts`: readiness and normalized-core helpers.
- `convex/mortgages/provenance.ts`: current mortgage activation source type is admin-only and needs widening for Velocity.
- GitNexus: `activateMortgageAggregate` upstream impact LOW; direct caller `convex/admin/origination/commit.ts`.

## Validation
- `bun run test -- src/test/convex/velocity/activation.test.ts`: expected red before implementation, then pass after chunk.
- `python3 /Users/connor/.codex/skills/linear-implement-v2/scripts/validate_execution_artifacts.py ENG-333 --repo-root "/Users/connor/.codex/worktrees/4ef4/fairlendapp" --stage ready-to-edit`: pass before edits.
