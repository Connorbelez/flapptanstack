# Summary: ENG-298 - Broker portal: make WorkOS sign-in, callback, and logout host-aware

- Source issue: https://linear.app/fairlend/issue/ENG-298/broker-portal-make-workos-sign-in-callback-and-logout-host-aware
- Primary plan: https://www.notion.so/348fc1b4402481b690fcdc99f119a064
- Supporting docs:
  - https://www.notion.so/33ffc1b4402481f3b1f5d84c9cf98b0b
  - https://www.notion.so/33ffc1b44024815fb1ddc83c4d4195f9
  - https://www.notion.so/33ffc1b4402480948e5ef7950f3095d4

## Scope
- Add host-aware auth-state and routing helpers that derive per-request WorkOS `redirectUri`, same-origin post-auth completion paths, and host-aware sign-out `returnTo` values from the existing root `portalContext`.
- Update `src/routes/sign-in.tsx` and `src/routes/sign-up.tsx` to preserve the current `buildSignInRedirect` call shape while issuing host-aware WorkOS URLs.
- Add a portal-aware post-auth completion route that validates signed state, resolves the authenticated user's `homePortalId`, keeps valid portal-host users on-host, renders wrong-portal rejection UI on the initiating host, and fails closed on tampering or stale portal data.
- Thread host-aware logout through the existing WorkOS client sign-out surface and update localhost-focused auth helper and route coverage.

## Constraints
- Treat `ENG-297` as the source of truth for host parsing and pre-auth `portalContext`; do not re-parse hosts in leaf auth routes.
- `buildSignInRedirect` has a `CRITICAL` GitNexus upstream blast radius, so its call shape must remain stable and unchanged.
- `handleWorkosSignOut` has a `LOW` GitNexus blast radius and can be extended additively for `returnTo`.
- Keep WorkOS AuthKit on supported APIs. Its callback handler redirects on the same origin using `returnPathname`, so cross-host behavior must happen in a post-auth completion route instead of private callback internals.
- Preserve safe internal redirect sanitization and fail closed for tampered auth state, unavailable portals, missing `homePortalId`, or wrong-portal access.
- Keep local and E2E host coverage on `localhost` and `*.localhost` only.
- Keep admin bypass logic explicit through FairLend admin authorization rules; do not create implicit cross-portal redirects.

## Open questions
- none
