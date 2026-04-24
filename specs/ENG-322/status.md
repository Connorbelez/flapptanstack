# Execution Status: ENG-322 - Broker onboarding: ship production self-serve wizard and branded preview

- Overall status: complete
- Current phase: complete
- Current chunk: chunk-03-tests-validation-audit
- Last updated: 2026-04-24T13:35:00Z

## Active focus
- Implementation, validation, audit, and artifact closure are complete.

## Blockers
- none

## Notes
- Backend dependency contracts from ENG-316, ENG-319, and ENG-320 exist in this worktree.
- Production `/onboard` route is currently a placeholder protected by `guardRouteAccess("onboarding")`.
- The implementation should avoid modifying `buildBrokerOnboardingApplicationReadModel` unless necessary because GitNexus reports MEDIUM blast radius.
- E2E and Storybook are planned as explicit applicability decisions after component tests are in place.
- Ready-to-edit artifact validation passed on 2026-04-24T13:05Z.
- Implemented public `/onboard` shell, server-backed route branching, referral helpers, portal preview query, onboarding screens, and focused tests.
- E2E omitted because component/Convex tests cover route state branches and provider calls are mocked through existing server boundaries.
- Storybook omitted because the new surfaces are route-local WorkOS/Convex screens, not reusable design-system components.
- Validation passed: targeted onboarding route/status/note tests, portal registry test, `bunx convex codegen`, `bun check`, and `bun typecheck`.
- `$linear-pr-spec-audit` passed with no findings.
