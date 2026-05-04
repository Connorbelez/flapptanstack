# Chunk Context: chunk-01-backend-detail-contract

## Goal
- Extend the Velocity workspace detail query so UI can render activation/remediation state without direct client-side table queries or local rule reconstruction.

## Relevant plan excerpts
- "Render the activation preview, stale-review state, activation blockers, remediation state, and retry affordances from backend DTOs."
- "Do not invent readiness, review, or activation rules locally in React; consume backend payloads verbatim."
- Activation failure contract requires activation idempotency key, provider refs, failure code/message, and current stage to be visible enough for retry/remediation.

## Implementation notes
- `workspaceDetail` already returns `activation`, `fairlendOwned.finalReview`, `readiness`, snapshots, exceptions, and Velocity-owned normalized core fields.
- Add a latest activation attempt summary from `velocityActivationAttempts.by_workspace_started_at` ordered descending.
- Keep bank account number redacted by continuing to use `fairlendEnrichmentDetail`.
- No activation business rules should be added here.

## Existing code touchpoints
- `convex/velocity/workspaces.ts`: `workspaceDetail`, `getVelocityPackageWorkspace`.
- `src/components/admin/velocity/types.ts`: derives `VelocityWorkspaceDetail` from the query return type.
- `src/test/convex/velocity/workspaces.test.ts`: existing workspace detail coverage.
- GitNexus impact attempted and unresolved by index; direct references indicate low-to-moderate risk because this extends an existing DTO.

## Validation
- Targeted backend test: `bun test src/test/convex/velocity/workspaces.test.ts`.
- Later full gates: `bun check`, `bun typecheck`, `bunx convex codegen`.
