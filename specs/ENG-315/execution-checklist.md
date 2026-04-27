# Execution Checklist: ENG-315 - Broker onboarding: lock verification-provider and auth contracts

## Requirements From Linear
- [x] Define one regulator lookup interface that supports deterministic mock data, imported Ontario data, and future live regulator adapters without changing onboarding business logic.
- [x] Define one IDV interface that normalizes start, callback, review, fraud, and evidence-reference behavior without leaking vendor-native payloads into the domain layer.
- [x] Define a WorkOS-backed email-verification contract that makes the invariant `verified email before trusted IDV` structural and testable.
- [x] Define the normalized verification snapshot and approval-recommendation vocabulary consumed by the application aggregate, admin review, and downstream handoff logic.
- [x] Define typed config ownership for thresholds, freshness windows, provider mode, province enablement, and fallback behavior.
- [x] Define fail-closed behavior for unavailable providers, malformed callbacks, stale regulator data, unsupported provinces, and missing config.
- [x] Reconcile the runtime-vs-doc onboarding permission drift by making it explicit that later slices consume both `onboarding:review` and `onboarding:manage`, and update the canonical RBAC doc or linked contract source accordingly.
- [x] Keep every seam dependency-injected or strategy-selected rather than hidden inside routes, mutations, or GT effects.
- [x] Leave downstream issues with exact contract names and outcomes instead of prose-only intent.

## Definition Of Done From Linear
- [x] Provider interfaces and normalized result contracts exist in code, not only in prose.
- [x] Mock and imported-data implementations can be selected without code edits in the business layer.
- [x] The WorkOS-backed email-verification contract is explicit and testable.
- [x] Evidence references and review-facing snapshot shapes are stable enough for downstream admin tooling.
- [x] The `onboarding:review` / `onboarding:manage` contract is explicit enough that later agents do not guess the permission model.
- [x] Downstream issues can reference exact contracts instead of reopening provider or auth decisions.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated for provider resolution, normalized contract behavior, fail-closed recommendation mapping, and the WorkOS-backed email-verification contract.
- [x] E2E tests added or updated if implementation expands into a real operator or broker workflow.
E2E note: the current ENG-315 scope is contract and backend-only, so e2e coverage is not expected unless scope expands.
- [x] Storybook stories added or updated if this issue unexpectedly grows reusable UI surface.
Storybook note: the current ENG-315 plan does not include reusable UI or screen work.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] Required quality gates passed.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
