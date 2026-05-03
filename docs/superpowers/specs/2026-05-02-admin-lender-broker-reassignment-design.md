# Admin Lender Broker Reassignment Design

## Purpose

Admins need to reassign a lender from one sponsoring broker to another from the admin lender detail surface. The reassignment changes the lender's canonical broker relationship, portal entry point, and WorkOS organization membership. It does not move existing deals, mortgages, ledger entries, portfolio positions, or historical audit records.

The operation must be all-or-nothing from the application's perspective: Convex canonical lender assignment must not change unless the required WorkOS organization transfer succeeds.

## Current Context

The admin lender detail panel already has a dedicated `Broker` section that shows the sponsoring broker record and links to the broker detail sheet. Lenders have a canonical `brokerId` and a denormalized `orgId` on the `lenders` table. The schema describes `lenders.orgId` as the WorkOS organization id denormalized from the broker for indexing.

Portal assignment currently resolves lender home access primarily from `lenders.brokerId`, then falls through to organization membership portals and finally the global FairLend portal. FairLend-owned brokers are identified by `brokers.orgId === FAIRLEND_BROKERAGE_ORG_ID`. All FairLend-owned brokers should route lenders to the global FairLend portal on the `app` subdomain. Only third-party external brokers get their own subdomain.

`WorkosProvisioning` currently supports creating organization memberships but does not yet expose a membership removal operation. This feature requires adding that capability behind the same injectable interface so tests can mock it.

## Recommendation

Build a dedicated admin broker reassignment workflow. Keep the UI in the existing lender detail `Broker` section, and execute the change through a backend Convex action that performs WorkOS side effects before patching Convex.

This is preferable to a generic relation editor because the operation has identity-boundary effects and portal-routing consequences. It is also preferable to a database-only update because that would let the lender's canonical assignment drift from their WorkOS org membership and portal access.

## Admin Experience

The `Broker` section on the lender detail panel should gain a `Change broker` action. Activating it opens a dialog or side sheet with a searchable broker picker.

The picker should include any active broker from any organization. Each result should show the broker display name, brokerage or organization label, broker status, and the portal that the lender would use after reassignment.

After an admin selects a target broker, the UI should show a preview:

- current broker, current WorkOS org, and current portal host
- target broker, target WorkOS org, and new portal host
- whether the portal host changes, for example from `meridian.<domain>` to `app.<domain>`
- WorkOS membership actions that will happen
- confirmation copy stating that existing deals, mortgages, ledger entries, portfolio positions, and audit history are not reassigned

The confirmation button should be disabled when the target broker is inactive, the target portal cannot be resolved, the current assignment is stale, or the backend reports a blocking validation error.

## Backend Contracts

Add focused admin endpoints under an admin lender reassignment module.

`searchActiveBrokerTargets` returns active broker targets across all organizations. The result should include enough display metadata for the picker and a portal summary for each broker.

`previewBrokerReassignment` returns the current assignment, target assignment, portal transition, WorkOS organization transition, and any blocking validation messages. This endpoint is the source of truth for the confirmation UI.

`reassignBroker` is a Convex action because it calls WorkOS. It accepts the lender id, target broker id, and expected current broker/org values for stale-form protection. It returns the final broker, organization, portal host, and audit or evidence id.

The final Convex patch should update:

- `lenders.brokerId`
- `lenders.orgId`
- `users.homePortalId`

It should not update deal, mortgage, ledger, position, or historical audit records.

## Portal Resolution Rules

The target portal is derived from the target broker:

- If `targetBroker.orgId === FAIRLEND_BROKERAGE_ORG_ID`, the target portal is the global FairLend portal on the `app` subdomain.
- Otherwise, the target portal is the active published portal for `targetBroker._id`.

External broker reassignment should fail closed when the external broker has no active published portal. FairLend-owned broker reassignment should ensure or resolve the global FairLend portal.

The home-portal assignment helper should also encode the FairLend-owned broker special case so future automatic portal resolution matches the explicit reassignment workflow.

## WorkOS Transfer Rules

The action should transfer the lender user's WorkOS organization membership to the target broker's organization with the lender role.

The intended sequence is:

1. Validate the FairLend admin actor.
2. Load the lender, lender user, current broker, and target broker.
3. Resolve current and target WorkOS organizations.
4. Resolve current and target portals.
5. Create or ensure the lender membership in the target WorkOS organization with the lender role.
6. Remove the lender membership from the old broker WorkOS organization.
7. Patch Convex canonical assignment only after WorkOS transfer succeeds.
8. Record audit or evidence with before and after broker, org, portal, actor, and WorkOS membership identifiers.

If the target org already contains an active lender membership for the user, the add step should be idempotent. The old org removal should only target the current broker organization membership for this lender, not unrelated FairLend staff, lawyer, borrower, or other organizational memberships.

## Failure Handling

The reassignment must be conservative.

If target broker validation fails, abort before any WorkOS call.

If target portal resolution fails, abort before any WorkOS call.

If WorkOS cannot add or ensure the target organization membership, abort and leave Convex unchanged.

If WorkOS adds the target membership but cannot remove the old broker organization membership, attempt rollback by removing the newly added target membership. Then abort and leave Convex unchanged.

If rollback also fails, record a high-priority repair-needed audit or evidence event and leave Convex unchanged. The admin UI should report that the identity transfer is incomplete and the lender assignment was not changed.

If Convex patching fails after WorkOS succeeds, record a repair-needed event because the identity system has already moved while the canonical assignment did not. This should surface clearly to admins and tests should cover the branch.

## Authorization And Audit

Only FairLend admins should be able to run the preview and reassignment operation. The action should use the existing admin/FairLend staff authorization boundary rather than relying on the selected broker's org.

Successful audit evidence should include:

- admin actor user id and WorkOS subject
- lender id and lender user id
- previous broker id and target broker id
- previous org id and target org id
- previous portal id/host and target portal id/host
- WorkOS membership ids when available
- timestamp and outcome

Failed or partially rolled back attempts should also be recorded with the failure phase and recovery status.

## Testing

Backend tests should cover:

- active broker search includes active brokers across multiple organizations
- inactive brokers are excluded or blocked
- FairLend-owned target broker resolves to the global `app` portal
- external target broker resolves to that broker's portal
- external target without active portal is blocked
- successful reassignment calls WorkOS add/remove and then patches `lenders.brokerId`, `lenders.orgId`, and `users.homePortalId`
- deals, mortgages, ledger entries, and historical records are not changed
- WorkOS add failure leaves Convex unchanged
- WorkOS old-org removal failure attempts rollback and leaves Convex unchanged
- rollback failure records repair-needed evidence and leaves Convex unchanged
- stale current assignment arguments block the operation

Frontend tests should cover:

- broker section exposes `Change broker`
- picker searches active brokers across orgs
- preview displays portal host changes
- confirmation copy names WorkOS membership movement and unchanged historical records
- blocking validation disables confirmation
- successful reassignment refreshes the broker section
- failure states display actionable admin messages

End-to-end coverage should include a representative external-to-FairLend reassignment where the displayed portal changes from a broker subdomain to `app.localhost:3000`.

## Out Of Scope

This feature does not reassign existing deals, mortgages, renewals, ledger entries, document packages, portfolio positions, or audit history. Those records continue to reflect the broker relationships that existed when they were created unless a separate explicit reassignment workflow is built.

This feature does not implement a generic relationship editor for all admin detail panels.

This feature does not create broker portals. External target brokers must already have an active published portal.
