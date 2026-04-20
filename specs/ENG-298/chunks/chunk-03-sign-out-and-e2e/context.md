# Chunk Context: chunk-03-sign-out-and-e2e

## Goal
- Finish the host-aware runtime behavior by preserving host class on sign-out and updating localhost-focused auth helpers and coverage for the new marketing, app, and broker-host flows.

## Relevant plan excerpts
- "Logout must preserve host class and current portal public return target."
- "Sign-out from a portal host must return to that same portal's public host path."
- "Sign-out from a marketing host must return to marketing."
- "Local auth and E2E coverage must use localhost and `*.localhost` only."
- "`e2e/helpers/workos-login.ts` always starts at `/sign-in` ... parameterize the helper with entry host and path so E2E can cover both host classes."

## Implementation notes
- Pass `returnTo` through the existing WorkOS client sign-out surface instead of creating a separate logout mechanism.
- Update both the dedicated sign-out route and the shared signed-in header/menu flow so broker-host sign-out returns to the initiating host class consistently.
- Keep localhost helpers aligned with the portal contract from `ENG-297`: `localhost:3000`, `app.localhost:3000`, and `<portal>.localhost:3000`.
- Storybook is expected to be non-applicable unless the rejection surface becomes a reusable component needing isolated UI state coverage.

## Existing code touchpoints
- `src/lib/workos-sign-out.ts`
- `src/routes/sign-out.tsx`
- `src/components/workos-user.tsx`
- `e2e/helpers/workos-login.ts`
- GitNexus impact: `handleWorkosSignOut` is `LOW` upstream risk with direct callers in `sign-out.tsx` and `workos-user.tsx`.

## Validation
- Targeted sign-out and auth route tests
- Relevant `bun run test:e2e` coverage if the local multi-host harness supports the updated flows
