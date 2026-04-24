# Chunk Context: chunk-03-workspace-upsert

## Goal
- Persist normalized sync results into the Velocity package aggregate with idempotent workspace creation, snapshotting, readiness, exceptions, audit entries, and manual sync.

## Relevant plan excerpts
- No duplicate workspaces may exist for the same non-empty `linkApplicationId`.
- Full-deal sync idempotency key recommendation: `velocity:sync:<linkApplicationId>:<rawDealHash>`.
- Workspace creation and snapshotting are idempotent on repeated webhook delivery and repeated full-deal hashes.
- Package lifecycle events must append to the existing append-only audit pipeline.

## Implementation notes
- Lookup by `linkApplicationId`; treat duplicate rows as identity collisions and open a blocking exception.
- Preserve FairLend-owned enrichment when updating Velocity-owned normalized core.
- Create `upstream_core` snapshots only when `normalizedCoreHash` changes.
- Recompute workspace state from readiness/status semantics without adding new persisted states for `Parked`, `Cancelled`, or `Declined`.
- Open package exceptions for missing identity, collision, upstream sync failures, unsupported mappings, and required-core-field failures.
- Manual sync should be a fluent Convex endpoint and share the same sync implementation as webhook processing.

## Existing code touchpoints
- `convex/velocity/audit.ts`: append-only package audit helper.
- `convex/velocity/provenance.ts`: Velocity workflow source helpers.
- `convex/schema.ts`: Velocity workspace, snapshot, sync attempt, webhook, and exception tables.
- `convex/fluent.ts`: fluent builder and auth middleware.
- `convex/admin/origination/cases.ts`: reference for authenticated/admin mutation patterns and user/org lookup.
- New planned file: `convex/velocity/workspaces.ts`.
- GitNexus impact checks to run before edits: `appendVelocityPackageAuditEntry`, `buildVelocitySyncIdempotencyKey`, `buildVelocityMortgageActivationSource`, `requireFairLendAdmin`.

## Validation
- Unit tests for workspace create/update idempotency, duplicate hash no-op, identity exceptions, snapshot creation, audit provenance, and manual-sync/webhook convergence.
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
