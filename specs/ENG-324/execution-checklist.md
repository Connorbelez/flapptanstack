# Execution Checklist: ENG-324 - Broker onboarding: ship admin review queue and override workflow

## Requirements From Linear
- [x] Expose a queue of reviewable broker applications with status, freshness, key mismatch reasons, and timestamps needed for triage.
- [x] Expose a dossier view showing self-reported data, normalized regulator results, normalized IDV results, portal setup selections, reason codes, evidence references, review thread, and audit history.
- [x] Require an explicit reviewer note on every approve, request-changes, and reject action.
- [x] Require `Request changes` to carry reopened-field or section keys plus reverification flags so the broker correction surface can be precise.
- [x] Persist broker notes from the submitted-status page into the same append-only review thread the reviewer sees.
- [x] Transition the application through explicit server-owned commands instead of patching state directly.
- [x] When approving, surface the downstream onboardingRequest or activation handoff status so operations can see whether provisioning continued successfully.
- [x] Gate the surface structurally using FairLend staff-admin patterns plus onboarding permissions; `admin:access` alone must not weaken explicit staff-boundary enforcement where the repo already requires it.
- [x] Keep queue and dossier screens driven by normalized summaries rather than raw vendor payload parsing in components.
- [x] Make the distinction between application `approved` and fully `activated` visible to operations so approval does not imply downstream provisioning already succeeded.

## Definition Of Done From Linear
- [x] Authorized reviewers can review and resolve submitted broker applications.
- [x] The dossier shows normalized evidence, portal setup context, and append-only conversation history.
- [x] Approval, request changes, and rejection all require explicit reviewer reasoning.
- [x] Request-changes payloads are structured enough to power the focused broker correction flow.
- [x] Broker notes append into the same review thread.
- [x] Unauthorized access is structurally denied.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated for permission enforcement, queue filtering, dossier projections, append-only thread writes, request-changes payload validation, broker-note ingestion, and approval-vs-activation visibility.
- [x] Route/component tests added or updated for the admin review workspace workflow.
- [x] E2E tests are not expected unless a full browser flow is added; record justification if route/component coverage is sufficient.
  - No full browser-auth flow was introduced; backend command tests and route/component source-contract coverage are the right level for this slice.
- [x] Storybook stories are not expected unless reusable UI components become broadly shared; record justification if route/component coverage is sufficient.
  - The page is a route-level composition using existing UI primitives, not a reusable shared component requiring Storybook coverage.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] Required quality gates passed or blockers are explicitly recorded: `bunx convex codegen`, `bun check`, and `bun typecheck`.
  - `bunx convex codegen` and `bun typecheck` pass. Full `bun check` is blocked by unrelated pre-existing complexity diagnostics; focused ENG-324 Biome check passes.
- [x] Targeted tests passed for changed backend and route/component scope.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
