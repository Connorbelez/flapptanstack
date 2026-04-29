# Execution Checklist: ENG-319 - Broker onboarding: implement verification pipeline and abuse controls

## Requirements From Linear
- [x] Enforce verified email as a hard prerequisite before any IDV session is started or any IDV callback is trusted.
- [x] Read brokerage and personal-license evidence through the normalized regulator provider rather than direct table reads scattered through handlers.
- [x] Normalize IDV results from callbacks or webhooks into the shared verification snapshot contract and verify callback authenticity before trusting them.
- [x] Compute three-way similarity using normalized names and the minimum pairwise score as the effective score.
- [x] Auto-approve only when all three sources are present, regulator status is active, regulator data is fresh, no fraud signal exists, and effective score is `>= 0.92`.
- [x] Route to review-needed when the effective score is `0.78-0.92` or any source is missing, incomplete, stale, or otherwise reviewable.
- [x] Reject when the effective score is `< 0.78`, the regulator record is inactive or not found, or the IDV provider emits a hard fraud outcome.
- [x] Persist reason codes, evidence references, and recommendation metadata so admin review does not recompute policy in the UI.
- [x] Use the existing Convex rate limiter integration for verification entry points and callbacks.
- [x] Support deterministic mock-provider flows so the full runtime is executable without live vendor access.

## Definition Of Done From Linear
- [x] Verification entry points and callback handling exist behind normalized provider contracts.
- [x] Email-before-IDV is structurally enforced through WorkOS-backed auth state.
- [x] Three-way scoring and recommendation mapping are test-covered at threshold boundaries.
- [x] `brokerOnboardingApplication` carries normalized verification snapshots, evidence references, explicit reason codes, and reverification-invalidated state where needed.
- [x] Abuse controls use the repo's existing rate-limiter component.
- [x] The full runtime is executable with mock providers in local development.

## Acceptance Criteria
- [x] Unverified WorkOS email blocks IDV session creation and causes inbound callbacks to fail closed.
- [x] A stale but otherwise matching regulator result maps to review-needed, not auto-approval.
- [x] Effective score `>= 0.92` with fresh active regulator evidence and no fraud signal produces auto-approval intent.
- [x] Effective score `0.78-0.92` or incomplete evidence produces review-needed intent that leaves the application in reviewer attention, not silent approval.
- [x] Effective score `< 0.78`, inactive/not-found regulator, or explicit fraud output produces rejection intent.
- [x] Reopened identity or licensing fields invalidate prior evidence and mark reverification as required.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated for name matching, runtime recommendation logic, callback verification/processing, and reverification invalidation.
- [x] E2E tests evaluated; not applicable because this backend/domain slice does not introduce a new user or operator workflow in the current branch.
- [x] Storybook evaluated; not applicable because this slice does not introduce reusable UI or admin-review surfaces.

## Final Validation
- [x] All requirements are satisfied
- [x] All definition-of-done items are satisfied
- [x] Required quality gates passed for the ENG-319 scope (`bunx convex codegen`, `bun check`, `bun typecheck`, and focused onboarding tests). Full `bun run test` was also attempted and remains blocked by unrelated non-onboarding failures.
- [x] Test coverage expectations were met or explicitly justified
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded
