# Chunk Context: chunk-02-review-transitions

## Goal
- Deliver governed approve/reject mutations for MIC requests and schedule provisioning from approval.

## Relevant plan excerpts
- "Approve requires FairLend admin/admin-review authority and runs the Transition Engine."
- "Reject requires FairLend admin/admin-review authority, trims and requires a non-empty reason, and runs the Transition Engine."
- "Approval starts provisioning exactly once per active journal/effect id and is safe to retry."
- "Rejecting a request never attempts provisioning and never grants access."

## Implementation notes
- Extend `micInvestorAccessRequestMachine` so `APPROVE` transitions to `approved` and schedules a new provisioning effect action.
- Add admin `approveRequest` / `rejectRequest` to `convex/micInvestorAccessRequests/mutations.ts`.
- Use `executeTransition(ctx, { entityType: "micInvestorAccessRequest", ... })` with `buildSource(ctx.viewer, "admin_dashboard")`.
- Store `reviewedBy`, `reviewedAt`, and trimmed `rejectionReason` after a successful transition.
- Add audit log entries for review outcomes with transition journal metadata.

## Existing code touchpoints
- `convex/engine/machines/micInvestorAccessRequest.machine.ts`: existing symbol not found by GitNexus by name; low isolated scope based on registry use.
- `convex/micInvestorAccessRequests/mutations.ts`: add exports; preserve public submit behavior.
- `convex/onboarding/mutations.ts`: approve/reject structure.
- `convex/engine/effects/registry.ts`: effect action is registered in chunk 03.
- GitNexus: `executeTransition` is CRITICAL if modified; this chunk only calls it.

## Validation
- Tests for successful approve/reject, empty rejection reason, invalid state rejection, no provisioning on rejection, effect scheduled on approval, and non-admin rejection.
