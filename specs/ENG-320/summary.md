# Summary: ENG-320 - Broker onboarding: hand off approved application into onboardingRequest and activate canonical broker/portal

- Source issue: https://linear.app/fairlend/issue/ENG-320/broker-onboarding-hand-off-approved-application-into-onboardingrequest
- Primary plan: https://www.notion.so/349fc1b440248106b28ef8aef78a2ace
- Supporting docs:
  - Broker Onboarding goal: https://www.notion.so/30ffc1b440248007a921c855c6e6adfa
  - Resolve-or-Provision Pattern: https://www.notion.so/313fc1b4402481f9a6d7f7d775d7d7d1
  - ADR: Onboarding State Management: https://www.notion.so/317fc1b44024811b8f51fc75a9f18350
  - ENG-316 plan: https://www.notion.so/349fc1b440248125bd94dc0fd00f356b
  - ENG-319 plan: https://www.notion.so/349fc1b440248116b199f91bf374cb4d

## Scope
- Extend the existing `brokerOnboardingApplications` aggregate so an approved application creates or links exactly one downstream broker `onboardingRequest`.
- Reuse the current `onboardingRequest` approval and provisioning effect path rather than duplicating WorkOS org or membership provisioning.
- Add a canonical broker resolve-or-provision helper that consumes verified application identity, preserves `_id` stability, and fails closed on duplicate, cross-user, or cross-org matches.
- Add a reusable broker portal activation helper that uses shared portal slug, host, pricing, and registry invariant helpers.
- Synchronize `users.homePortalId` through `convex/portals/homePortalAssignment.ts`.
- Persist durable activation, referral, and provenance links across application, onboarding request, broker, and portal records.
- Return a stable activation outcome from the backend activation seam for route, admin, and future claim consumers.

## Constraints
- Do not bypass the downstream `onboardingRequest` Governed Transition path or direct-patch it to `role_assigned`.
- Do not alter shared transition-engine semantics; keep changes additive around broker onboarding, onboarding effects, and helper extraction.
- Do not duplicate slug normalization, reserved slug checks, or host derivation outside the shared portal contract/helpers.
- Do not create duplicate broker rows for the same verified user, license, or organization.
- Treat `brokerOnboardingApplication.status === "activated"` as downstream provisioning plus broker, portal, and home-portal sync complete.
- Upstream ENG-316 and ENG-319 contracts are present in this worktree and should be consumed rather than forked.

## Open questions
- none
