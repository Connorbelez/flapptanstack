# Execution Checklist: ENG-320 - Broker onboarding: hand off approved application into onboardingRequest and activate canonical broker/portal

## Requirements From Linear
- [x] Create or link one canonical `onboardingRequest` for each approved broker application instead of reimplementing role review and provisioning logic inside the application aggregate.
- [x] Preserve linkage between the application record and the downstream `onboardingRequest` so audit, support, and status surfaces can follow the handoff.
- [x] Resolve or provision the canonical broker record using verified identity inputs and fail closed on ambiguous or conflicting matches.
- [x] Reuse the shared portal slug and host contract for slug normalization, reserved-word rejection, host derivation, and portal attribution.
- [x] Create or patch the canonical broker portal through the existing portal registry and invariant helpers.
- [x] Synchronize `users.homePortalId` through the existing home-portal assignment helpers so auth completion and portal-aware routing immediately reflect the new broker portal.
- [x] Persist referral attribution from the application onto durable canonical records.
- [x] Expose a stable activation outcome for route and admin consumers without leaking internal provisioning details.
- [x] Keep the write path idempotent or explicitly fail closed when slug conflicts, duplicate identities, or partial retries occur.
- [x] Make it explicit in code that application `activated` is downstream-provisioning-complete, not just application-approved.

## Definition Of Done From Linear
- [x] Approved broker applications hand off into a canonical `onboardingRequest` instead of bypassing it.
- [x] Canonical broker and portal records are created or reused through one backend activation seam.
- [x] Shared portal contracts own slug and host logic.
- [x] `users.homePortalId` is synchronized through the shared assignment path.
- [x] Activation is idempotent or explicitly fail-closed on conflicts.
- [x] Application `activated` means downstream provisioning and portal assignment are complete.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated for application-to-request handoff and downstream provisioning effect reuse.
- [x] Unit tests added or updated for broker identity reuse, ambiguous or conflicting matches, portal slug conflicts, home-portal sync, idempotent retries, and activation completion semantics.
- [x] E2E tests are not required for this backend-only issue because route behavior did not change; home portal sync is verified at the backend seam.
- [x] Storybook stories are not applicable because this issue does not introduce or modify reusable UI.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] `bunx convex codegen` passed.
- [x] `bun check` passed with existing non-blocking complexity warnings outside the ENG-320 diff.
- [x] `bun typecheck` passed.
- [x] Focused backend tests passed.
- [x] Final `$linear-pr-spec-audit` review passed for ENG-320 scope; unrelated full-suite failures are explicitly recorded in `audit.md`.
