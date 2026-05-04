# Chunk Context: chunk-03-route-and-auth-resume

## Goal
- Add the unauthenticated verification entry route and authenticated WorkOS resume path for guest lawyer invitation acceptance.

## Relevant plan excerpts
- "Verification flow requires WorkOS sign-in/sign-up and canonical `lawyer` role/permission semantics."
- "Verification route requires WorkOS auth, handles callback/resume, and calls Convex with server-derived auth/session context."
- "Expired, revoked, already-used, wrong-deal, or tampered token is rejected fail-closed."

## Implementation notes
- Use WorkOS AuthKit as source of truth. Server route auth state must use `getAuth`.
- Existing `/callback` currently delegates to `handleCallbackRoute()`. Existing `/auth-complete` demonstrates a server function using `getAuth`.
- Route UI should be functional and restrained. No Storybook is required unless new reusable UI components are extracted.

## Existing code touchpoints
- `src/routes/callback.tsx`
- `src/routes/auth-complete.tsx`
- New expected route: `src/routes/lawyer/verify.$token.tsx`
- Possible helper under `src/lib` if route state/resume token handling needs extraction.

## Validation
- Route/integration tests for unauthenticated redirect/resume and fail-closed states.
- E2E run if the route/auth flow can be exercised locally with existing WorkOS helpers.
