# Summary: ENG-316 - Broker onboarding: add brokerOnboardingApplication aggregate and onboardingRequest handoff

- Source issue: https://linear.app/fairlend/issue/ENG-316/broker-onboarding-add-brokeronboardingapplication-aggregate-and
- Primary plan: https://www.notion.so/349fc1b440248125bd94dc0fd00f356b
- Supporting docs:
  - https://linear.app/fairlend/issue/ENG-315/broker-onboarding-lock-verification-provider-and-auth-contracts
  - https://www.notion.so/317fc1b44024811b8f51fc75a9f18350
  - https://www.notion.so/317fc1b4402481bcb72be32db2a57693
  - https://www.notion.so/30ffc1b440248007a921c855c6e6adfa

## Scope
- Add `brokerOnboardingApplications` as the canonical self-serve broker-application aggregate instead of reusing `onboardingRequests`, `lenderOnboardings`, or a generic onboarding-session abstraction.
- Register the aggregate as a governed entity with the narrow top-level lifecycle `draft`, `submitted`, `changes_requested`, `approved`, `rejected`, and `activated`.
- Persist resumability, portal attribution, verification snapshot or recommendation metadata, reopened-field state, append-only review-thread primitives, and explicit linkage to the downstream `onboardingRequest`.
- Add server-owned start, resume, read, and submit surfaces so later portal routes and admin workflows consume backend state instead of inventing client-owned flow state.
- Define internal handoff and activation helpers so downstream work can reuse the `onboardingRequest` provisioning seam and the `activated` meaning without reopening the aggregate boundary question.
- Add focused backend tests for lifecycle registration, resumability, expiry, review-thread persistence, handoff linkage, and `activated` semantics.

## Constraints
- Keep the work additive. Do not modify shared Transition Engine semantics for this issue.
- Use `brokerOnboardingApplication` as the entity name and `brokerOnboardingApplications` as the table name; treat older `brokerOnboardings` wording in architecture docs as stale.
- Keep top-level lifecycle states narrow. Wizard step progress, verification checkpoints, and request-changes details belong in `machineContext` and explicit typed fields, not new GT statuses.
- Treat `approved` as application-approved and `activated` as downstream provisioning complete only after the linked `onboardingRequest` reaches `role_assigned` and portal or home-portal side effects succeed.
- Reuse the existing `onboardingRequest` provisioning seam and `convex/engine/effects/onboarding.ts`; do not rebuild downstream provisioning inside the new aggregate.
- Capture `portalId` from the active trusted portal context at application creation time and keep portal alignment consistent with `shared/portal/contracts.ts` and `convex/portals/homePortalAssignment.ts`.
- Reuse the normalized verification contracts and recommendation vocabulary from `ENG-315`; do not fork snapshot or reason-code enums locally.
- Keep review-thread history append-only with canonical entry types `reviewer_note`, `broker_note`, and `system_event`.
- Preserve an explicit 30-day resumability window with readable expiry behavior instead of an implicit TTL-only contract.

## Open questions
- none
