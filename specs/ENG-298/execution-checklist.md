# Execution Checklist: ENG-298 - Broker portal: make WorkOS sign-in, callback, and logout host-aware

## Requirements From Linear
- [x] Generate host-aware sign-in and sign-up URLs with explicit `redirectUri` and signed state while preserving current `buildSignInRedirect` call sites.
- [x] Reuse existing safe-path sanitization and current root `portalContext`; do not reparse hosts in leaf auth routes or trust raw callback params.
- [x] Resolve marketing-host completions through `users.homePortalId` and canonical portal hosts.
- [x] Resolve portal-host completions against the current portal and same-portal membership or explicit FairLend admin override.
- [x] Render same-host wrong-portal rejection with a continue CTA to the assigned portal; never silently cross-redirect.
- [x] Pass same-host-class `returnTo` through WorkOS sign-out.
- [x] Parameterize `localhost` and `*.localhost` E2E auth entry paths and fail closed on tampered or stale state.

## Definition Of Done From Linear
- [x] Marketing-host sign-in lands on the canonical home-portal host.
- [x] Portal-host sign-in keeps valid users on-host and rejects wrong-portal non-admin users explicitly.
- [x] Sign-out returns users to the same host class they started from.
- [x] Auth-state tampering, missing `homePortalId`, or unavailable portal fails closed.
- [ ] `bunx convex codegen`, `bun check`, `bun typecheck`, and targeted auth route tests pass.
  `bunx convex codegen`, `bun typecheck`, and the targeted auth/Convex tests passed; `bun check` still fails on unrelated repo-wide complexity diagnostics outside ENG-298.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit and route tests are added or updated for auth-state encoding/validation, host-aware sign-in/up initiation, post-auth completion, wrong-portal rejection, and host-aware sign-out.
- [x] E2E auth coverage or helper updates cover marketing, FairLend app, and broker-host localhost entry paths where the harness supports those flows.
- [x] Storybook coverage is explicitly recorded as not applicable unless the rejection surface becomes a reusable component with standalone states worth documenting.
  `WrongPortalState` was kept route-specific for this issue, so Storybook is not applicable.

## Final Validation
- [x] All requirements are satisfied.
- [ ] All definition-of-done items are satisfied.
- [ ] Required quality gates passed.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
