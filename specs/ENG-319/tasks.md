# Tasks: ENG-319 - Broker onboarding: implement verification pipeline and abuse controls

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Finalize the implementation task list, chunk plan, supporting-doc set, and GitNexus pre-edit impact notes.

## Phase 2: Runtime Foundation
- [x] T-010: Extend broker-onboarding schema and validators for callback-event persistence, richer verification snapshot fields, and explicit reverification-invalidated state.
- [x] T-020: Add `convex/onboarding/verification/nameMatching.ts` with normalized three-way Jaro-Winkler scoring helpers and threshold-safe comparisons.
- [x] T-030: Add `convex/onboarding/verification/runtime.ts` to compose WorkOS email state, regulator provider lookups, IDV evidence, score calculation, reason-code mapping, and snapshot creation.

## Phase 3: Aggregate And Entrypoints
- [x] T-040: Extend `convex/onboarding/brokerApplication/internal.ts` with aggregate-owned recommendation application and reverification invalidation helpers.
- [x] T-050: Extend `convex/onboarding/brokerApplication/mutations.ts` so submit/request-changes flows recompute verification state and map outcomes to approved, reviewer-held submitted, or rejected without direct callback-driven status patching.
- [x] T-060: Expand `convex/onboarding/verification/actions.ts` with IDV start and explicit recompute entry points behind verified-email gating and provider contracts.

## Phase 4: Callbacks And Abuse Controls
- [x] T-070: Add `convex/onboarding/verification/abuse.ts` with reusable rate-limit configuration/helpers for IDV start, verification recompute, and callback processing.
- [x] T-080: Add `convex/onboarding/verification/callbackVerification.ts` and `convex/onboarding/verification/idvWebhook.ts`, then register the broker-onboarding callback route in `convex/http.ts`.
- [x] T-090: Add broker-onboarding callback persistence and normalized processing helpers for signature verification results, idempotency, and provider callback ingestion.

## Phase 5: Tests And Validation
- [x] T-100: Add focused tests for normalized name matching and threshold-boundary scoring.
- [x] T-110: Add focused tests for verification runtime outcomes, stale/fraud routing, and reverification invalidation after request-changes.
- [x] T-120: Add focused tests for callback authenticity/idempotency and verification rate limiting.
- [x] T-900: Run `bunx convex codegen`, `bun check`, `bun typecheck`, and the targeted onboarding verification test scope.

## Phase 9: Audit
- [x] T-910: Run `$linear-pr-spec-audit` against the current branch diff for `ENG-319`.
- [x] T-920: Resolve audit findings or record blockers, then rerun the necessary validation.
