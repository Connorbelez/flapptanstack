# Execution Checklist: ENG-322 - Broker onboarding: ship production self-serve wizard and branded preview

## Requirements From Linear
- [x] Replace the current placeholder onboarding production route with a real server-backed broker onboarding flow.
- [x] Provide a public intro or landing surface on the broker portal host and an authenticated wizard under `/onboard`.
- [x] Render current step and status from `brokerOnboardingApplication` rather than from local-only component state.
- [x] Preserve referral context from entry through resume and submission.
- [x] Show the approved value-prop portal teaser before the hardest verification step without implying the slug is already claimed.
- [x] Use the shared portal slug contract for normalization, reserved-word validation, host preview, and uniqueness checks. Do not copy slug logic into the UI.
- [x] Render the submitted status page with submitted details, reviewer expectations, portal teaser, and a thin add-note action.
- [x] Render a focused correction surface for `changes_requested` that shows reviewer note, reopened fields, reverification requirements, and resubmit.
- [x] Support resumability after refresh or later return by reloading the existing application from the server.
- [x] Use WorkOS auth correctly on both client and server paths; do not invent a second session model.
- [x] Treat `approved` and `activated` differently in the UX. If downstream provisioning is still in flight, do not render the broker as fully activated yet.

## Definition Of Done From Linear
- [x] Production onboarding route exists and is no longer a placeholder.
- [x] The UI renders from server-owned application state and supports resume.
- [x] Branded preview and slug selection use shared portal contracts.
- [x] Submitted and `changes_requested` states are first-class broker-facing screens.
- [x] The thin broker-note action appends into the review thread instead of creating a separate inbox.
- [x] The flow works end to end with mock providers on production routes.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit/component tests added for route branching, view-model mapping, portal teaser preview, status/correction rendering, and broker-note append behavior.
- [x] E2E tests are not expected for this slice unless the component tests cannot cover the production route states; record rationale if omitted.
  - Rationale: focused route/component tests cover every server projection branch and provider calls are mocked at the existing Convex action/mutation boundary.
- [x] Storybook stories are not expected because this issue creates route-local surfaces rather than reusable design-system components; record rationale if omitted.
  - Rationale: these are production route surfaces tied to WorkOS/Convex state, not reusable design-system primitives.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] `bunx convex codegen` passed.
- [x] `bun check` passed.
- [x] `bun typecheck` passed.
- [x] Targeted onboarding tests passed.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
