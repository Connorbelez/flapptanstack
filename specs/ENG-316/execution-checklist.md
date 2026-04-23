# Execution Checklist: ENG-316 - Broker onboarding: add brokerOnboardingApplication aggregate and onboardingRequest handoff

## Requirements From Linear
- [x] Introduce a dedicated `brokerOnboardingApplications` persistence boundary instead of reusing `onboardingRequests`, `lenderOnboardings`, or a generic session abstraction.
- [x] Register the aggregate in the existing server-owned transition architecture so status changes remain auditable and command-driven.
- [x] Capture the full top-level lifecycle `draft`, `submitted`, `changes_requested`, `approved`, `rejected`, and `activated`.
- [x] Capture resumability explicitly with `startedAt`, `lastActivityAt`, `expiresAt`, and stable lookup paths by authenticated user and verified email.
- [x] Capture `portalId` from the active host-aware portal context at application creation time.
- [x] Persist normalized verification snapshots or recommendation metadata, reopened-field state, and review-thread linkage on the application aggregate.
- [x] Provide start, resume, read, and submit handlers that return server-owned state to thin route consumers.
- [x] Define the explicit approval handoff contract into `onboardingRequest`, including link fields and the rule that `activated` only becomes legal after downstream provisioning completes.
- [x] Preserve a 30-day resumability window with explicit expiry behavior rather than hidden TTL interpretation.
- [x] Make it explicit in the contract that `activated` is downstream-provisioning-complete, not merely application-approved.

## Definition Of Done From Linear
- [x] `brokerOnboardingApplication` exists as the canonical self-serve broker-application aggregate.
- [x] The full top-level lifecycle is explicit and test-covered.
- [x] Start, resume, read, and submit contracts exist and return server-owned state.
- [x] Review-thread and reopened-field primitives exist for later admin-review work.
- [x] `activated` is defined as downstream provisioning complete, not merely approved.
- [x] Approval handoff into `onboardingRequest` is explicit enough that downstream issues do not reopen the aggregate boundary question.

## Plan-Derived Contract Checks
- [x] Naming is standardized on entity type `brokerOnboardingApplication` and table `brokerOnboardingApplications`, with stale `brokerOnboardings` wording kept out of code.
- [x] Top-level GT states stay narrow while wizard progress and request-changes metadata live in `machineContext` or explicit typed fields.
- [x] The implementation remains additive and does not alter shared Transition Engine behavior.
- [x] Portal attribution remains aligned with the existing host-aware and `users.homePortalId` seams.
- [x] Verification snapshot and recommendation fields reuse the `ENG-315` shared contracts instead of introducing local enums or payload shapes.
- [x] Review-thread history remains append-only and typed as `reviewer_note`, `broker_note`, and `system_event`.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated for lifecycle registration, start and resume behavior, expiry handling, review-thread persistence, and handoff linkage or activation semantics.
- [x] E2E tests are not applicable for this backend-only aggregate slice, or targeted E2E coverage is added if real route behavior becomes part of the implementation.
Not applicable: ENG-316 does not change route behavior or introduce a browser workflow.
- [x] Storybook is not applicable for this backend-only aggregate slice, or new stories are added if reusable UI surfaces become part of the implementation.
Not applicable: ENG-316 does not add reusable UI surfaces.

## Final Validation
- [x] All requirements are satisfied
- [x] All definition-of-done items are satisfied
- [x] Required quality gates passed
- [x] Test coverage expectations were met or explicitly justified
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded
