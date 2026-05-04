# Execution Checklist: ENG-354 - MIC portal: build admin triage and provisioning workflow

## Requirements From Linear
- [x] Admin list defaults to pending requests and supports filtering by `pending_review`, `approved`, `rejected`, and provisioning state.
- [x] Admin detail includes request fields, normalized email, portal, review metadata, provisioning metadata, and audit/history rows.
- [x] Approve mutation requires FairLend admin/admin-review permission and runs the Transition Engine rather than patching status directly.
- [x] Reject mutation requires a non-empty reason and runs the Transition Engine rather than patching status directly.
- [x] Approval starts provisioning exactly once per active journal/effect id and is safe to retry.
- [x] WorkOS user resolution first checks existing users by email; only creates a user if none exists.
- [x] Membership creation uses `organizationId=portal.orgId` and `roleSlug="micinvestor"`.
- [x] Already-existing membership is treated as idempotent success if it is for the MIC org and role.
- [x] Provisioning failure leaves `status="approved"` and `provisioningState="failed"`, with `provisioningError` visible to admin queries.
- [x] Rejecting a request never attempts provisioning and never grants access.
- [x] Audit log records approval, rejection, provisioning success, and provisioning failure with enough metadata for compliance review.
- [x] Keep exported Convex functions on fluent builders with explicit `.public()` or `.internal()`.

## Definition Of Done From Linear
- [x] Admins can list/filter MIC access requests and inspect histories.
- [x] Admins can approve and reject requests through governed transitions.
- [x] Approval provisions or records a visible provisioning exception.
- [x] Rejection never provisions access.
- [x] WorkOS calls are idempotent and test-covered.
- [x] Audit logs cover review and provisioning outcomes.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit/Convex tests added or updated for admin list/detail/history queries.
- [x] Unit/Convex tests added or updated for approve/reject mutations and auth rejection.
- [x] Unit/Convex tests added or updated for provisioning success, existing user, already-member idempotency, failure visibility, and retry/idempotency guards.
- [x] E2E tests are deferred because this slice does not add a full user-facing admin workflow beyond existing generic admin shell exposure.
- [x] Storybook stories are not required unless reusable UI components or composed screens are added.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] `bunx convex codegen` passed.
- [x] `bun check` passed.
- [x] `bun typecheck` passed.
- [x] Targeted MIC request/provisioning tests passed.
- [x] Existing onboarding effect tests passed if `getWorkosProvisioning()` changes.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
