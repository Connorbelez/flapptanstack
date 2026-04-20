# Chunk Context: chunk-02-auth-completion

## Goal
- Add the post-auth completion path that resolves the authenticated user's assigned portal, keeps valid users on the initiating host, renders explicit wrong-portal rejection when needed, and fails closed on invalid or stale state.

## Relevant plan excerpts
- "Marketing-host callback completion must resolve the authenticated user, load users.homePortalId, and redirect to that portal's canonical host."
- "Portal-host callback completion must re-resolve the current portal from the host and verify whether the authenticated user is allowed on that portal."
- "Non-admin users authenticating on the wrong portal host must see a hard rejection screen with a continue CTA to their assigned portal."
- "The callback route must not silently redirect a wrong-portal completion onto a different portal host."
- "Prefer a supported two-step completion flow over reimplementing AuthKit callback internals."

## Implementation notes
- Keep `src/routes/callback.tsx` on supported AuthKit APIs unless a narrow wiring change is required; the host-aware policy should live in the completion route instead of private library internals.
- Add a server-side lookup that uses the authenticated WorkOS identity to load the matching Convex user row and assigned portal.
- Treat FairLend admin access as an explicit bypass, not a silent redirect rule for non-admin users.
- Rejection UI must stay on the initiating host and surface a continue CTA to the assigned portal instead of bouncing automatically.

## Existing code touchpoints
- `src/routes/callback.tsx`
- `src/routes/unauthorized.tsx`
- `src/lib/auth-policy.ts`
- `convex/portals/queries.ts`
- `convex/fluent.ts`
- New route and component files for auth completion and wrong-portal rejection

## Validation
- Targeted auth completion route tests
- Any new Convex auth/portal lookup tests added for post-auth resolution
