# Chunk Context: chunk-01-routes-contracts

## Goal
- Add the route/query contract layer that connects the File Workspace UI to existing Convex APIs and TanStack Router.

## Relevant plan excerpts
- "`/files`: authenticated box index for admins and brokers."
- "`/files/$boxId`: authenticated box workspace."
- "`/files/public/$token`: unauthenticated public or magic-link view."
- "Authenticated route children using `useSuspenseQuery` must render under parent `Authenticated` / `AuthLoading` wrapper."

## Implementation notes
- Use `src/routes/listings/route.tsx` as the canonical auth-gated suspense wrapper.
- Query helpers should wrap `convexQuery(api.fileWorkspace.*)` where possible and expose stable component-facing types.
- Public bearer-link Convex functions are mutations because they write link/security access state; public route should use mutation hooks or component-level calls rather than a suspense query loader that requires auth.
- Keep route tests focused on route/component wiring; deeper UI behavior is covered in later chunks.

## Existing code touchpoints
- `src/routes/listings/route.tsx`: `ListingsLayout`, `Authenticated`, `AuthLoading`, `guardRouteAccess`.
- `src/routes/listings/index.tsx`: route loader and `useSuspenseQuery` pattern.
- `src/lib/auth.ts`: `ROUTE_AUTHORIZATION_RULES`, `guardRouteAccess`.
- `convex/fileWorkspace/readModels.ts`: `listBoxIndex`, `listNodes`, `listBearerNodes`, `getManagerSettings`, `getCapabilityPreview`.
- `convex/fileWorkspace/boxes.ts`: `createBox`, `getBox`, `listBoxes`.
- `convex/fileWorkspace/shareLinks.ts`: `resolveBearerLink`, `createShareLink`, `listShareLinks`, `revokeShareLink`.
- GitNexus impact checks required before editing existing route/auth symbols.

## Validation
- `bun run test -- src/test/routes/file-workspace-route.test.tsx`
- `bun typecheck` when the route/query contract compiles.
