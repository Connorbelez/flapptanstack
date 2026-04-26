# Chunk Context: chunk-03-provisioning-effect

## Goal
- Implement idempotent WorkOS provisioning for approved MIC requests and visible failure recording.

## Relevant plan excerpts
- "Provisioning resolves an existing WorkOS user by normalized email before creating one."
- "Provisioning creates MIC organization membership with `organizationId=portal.orgId` and `roleSlug=\"micinvestor\"`."
- "Already-member responses are treated as idempotent success when they match the MIC org/role."
- "WorkOS failures leave `status=\"approved\"`, set `provisioningState=\"failed\"`, store `provisioningError`, and keep the request visible."

## Implementation notes
- Add `convex/micInvestorAccessRequests/internal.ts` for internal lookups and mutation helpers.
- Begin helper should set `activeProvisioningJournalId` and `provisioningState="in_progress"` unless already processed/in-progress.
- Complete helper should store `invitedUserWorkosId`, `membershipWorkosId` when available, set `provisioningState="completed"`, clear active journal, and append processed journal id.
- Fail helper should keep `status="approved"`, set `provisioningState="failed"`, store normalized readable error, clear or retain active journal based on retry design, and log audit.
- Provisioning action uses `getWorkosProvisioning()` and should update `users.homePortalId` only when a synced user exists and it is empty or MIC-compatible.

## Existing code touchpoints
- `convex/engine/effects/workosProvisioning.ts`: GitNexus LOW risk, 4 direct dependents; preserve existing onboarding/origination call contracts.
- `convex/engine/effects/onboarding.ts`: idempotent membership and failure audit pattern.
- `convex/engine/effects/registry.ts`: register new action.
- `convex/portals/micConfig.ts`: active MIC portal/org resolution.
- `convex/schema.ts`: existing provisioning fields.

## Validation
- Tests for user lookup/create, membership creation with MIC org/role, idempotent already-member success, failure visibility, processed journal no-op, active journal conflict, and existing synced user home portal assignment.
- Existing onboarding effect tests if `WorkosProvisioning` return types change.
