# Execution Checklist: ENG-307 - Broker landing page: add borrower and mortgage-applicant portal-attribution handoff

## Requirements From Linear
- [x] Introduce dedicated public financing-start routes outside the auth-gated `/borrower` tree.
- [x] Route the top-level financing CTA, nested pre-approval CTA, and inline financing strip into the same route family.
- [x] Keep the landing page limited to path selection and lightweight prefill; move real form continuation to dedicated screens.
- [x] Align borrower and mortgage-applicant attribution with the explicit `portalId` contract from `ENG-302`.
- [x] Reuse existing downstream application entities such as `provisionalApplications` or `provisionalOffers` where they fit, rather than inventing a landing-page-only application model.
  No landing-only application model was introduced. Persistent application row creation is deferred until identity is available.
- [x] Define a minimal resume or prefill contract for the inline strip so the three captured fields can continue downstream without making the landing page stateful and complex.
- [x] Use host-aware auth only where it is actually required by the continuation flow, and preserve the portal host across those redirects.
  Financing routes remain public until the user chooses to continue; the CTA uses `/sign-up?redirect=...` on the same portal host.
- [x] Keep pre-approval as a nested continuation inside the financing route family, not a separate landing-page top-level branch.
- [x] Keep the implementation fail-closed on invalid or unavailable portal hosts.
- [x] Avoid demo mortgage-application components and mocked Zustand flows in production.

## Definition Of Done From Linear
- [x] The financing side of the switchboard reaches one real production continuation route family.
- [x] The nested pre-approval action reaches the correct dedicated continuation path.
- [x] The inline financing strip hands off into the same route family with only lightweight prefill.
- [x] Portal attribution is preserved end to end using the explicit borrower contract from `ENG-302`.
- [x] The borrower handoff does not rely on org equality.
- [x] The landing page remains short and does not become a full borrower application surface.
- [x] The implementation uses production routes and data contracts rather than demo mortgage-application code.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit or route tests added or updated for financing-route handoff and prefill behavior.
- [x] Convex or backend tests added where backend create/resume behavior changes.
  No backend create/resume behavior changed.
- [x] E2E coverage added or explicitly justified for the public landing-to-financing workflow.
  Route/component tests cover the changed contract; no browser-only workflow was introduced.
- [x] Storybook stories added or explicitly justified for changed reusable UI states.
  No reusable Storybook state was introduced.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] `bunx convex codegen` passed.
- [x] `bun check` passed.
- [x] `bun typecheck` passed.
- [x] Targeted tests for touched route/backend behavior passed.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
