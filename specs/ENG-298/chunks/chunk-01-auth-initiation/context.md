# Chunk Context: chunk-01-auth-initiation

## Goal
- Add the host-aware auth-state and routing primitives, then update sign-in/sign-up initiation so every auth round trip returns to a same-origin post-auth completion path with enough signed context to finish safely.

## Relevant plan excerpts
- "Sign-in/sign-up URL generation must become host-aware and use per-request redirect targets."
- "`buildSignInRedirect` has a critical GitNexus upstream blast radius ... Keep its call shape stable or add a parallel helper instead of breaking existing callers."
- "AuthKit supports explicit `redirectUri`, `returnPathname`, and client `signOut({ returnTo })`, which is enough to implement host-aware initiation without patching the auth provider."
- "Do not trust unsafely decoded callback query params for host routing."

## Implementation notes
- Keep `sanitizeRedirectPath` as the safe source of truth for internal paths and feed the sanitized path into the new signed auth-state payload.
- Use `portalContext` and `requestHost` from the root route context rather than reparsing the hostname inside `sign-in` or `sign-up`.
- Build absolute callback `redirectUri` values from the current host class and set `returnPathname` to a same-origin completion route that can evaluate the signed token after AuthKit creates the session.
- Preserve the existing `/sign-in` and `/sign-up` route contract so all current callers continue working.

## Existing code touchpoints
- `src/routes/sign-in.tsx`
- `src/routes/sign-up.tsx`
- `src/lib/auth-redirect.ts`
- `src/routes/__root.tsx`
- `shared/portal/contracts.ts`
- GitNexus impact: `buildSignInRedirect` is `CRITICAL` upstream risk and must remain stable.

## Validation
- `bunx vitest run src/test/routes/auth-routes.test.ts`
- Any new auth-state unit tests added in this chunk
