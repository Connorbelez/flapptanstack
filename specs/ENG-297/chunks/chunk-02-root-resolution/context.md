# Chunk Context: chunk-02-root-resolution

## Goal
- Add the trusted request-host seam, root portal classification/resolution, serializable portal context, and fail-closed boundary UI before child loaders run.

## Relevant plan excerpts
- `fairlend.ca`, `www.fairlend.ca`, and `localhost:3000` are marketing hosts.
- `app.fairlend.ca` and `app.localhost:3000` resolve to the FairLend portal row.
- Unknown portal hosts produce a portal-not-found state and do not silently fall back to marketing.
- Root portal context must be resolved beside auth state so child loaders consume one canonical context instead of parsing the host ad hoc.

## Implementation notes
- Preserve `fetchWorkosAuth` and `serverHttpClient.setAuth(token)` behavior in `src/routes/__root.tsx`.
- Centralize trusted host extraction once; do not broaden `sanitizeRedirectPath`, `buildSignInRedirect`, or the auth routes into host-resolution logic in this slice.
- Keep `src/routes/index.tsx` as a minimal already-resolved consumer, not the primary enforcement point.
- Add a small serializable portal cache-key helper instead of rewriting the global query hash function unless tests prove that is required.

## Existing code touchpoints
- `src/start.ts`
- `src/routes/__root.tsx`
- `src/router.tsx`
- `src/routes/index.tsx`
- `src/lib/auth-redirect.ts`
- `src/routes/sign-in.tsx`
- `src/routes/sign-up.tsx`

## Validation
- `bunx vitest run src/test/routes/portal-context.test.ts`
- `bun run test:e2e`
