# Chunk Context: chunk-01-admin-routing

## Goal
- Add Velocity package route entry points to the admin shell and structural authorization.

## Relevant plan excerpts
- "Add admin navigation, route authorization, and list/detail routes for Velocity packages."
- "Use the repo's structural auth and suspense-layout patterns where relevant."

## Implementation notes
- Follow `src/routes/admin/originations.tsx` and `src/routes/admin/originations.$caseId.tsx` for route state and guard patterns.
- Add a static navigation item under the payments/admin operational area.
- `guardRouteAccess` should use a new Velocity route key, likely with `mortgage:originate` operational permission plus FairLend admin override.
- Avoid suspense-specific layout unless the route introduces `useSuspenseQuery`; current nearby admin routes use `useQuery`.

## Existing code touchpoints
- `src/components/admin/shell/entity-registry.ts`: add static Velocity navigation item.
- `src/lib/auth.ts`: add route authorization key and admin path mapping.
- `src/routes/admin/velocity.tsx`: create list/detail parent route.
- `src/routes/admin/velocity.$workspaceId.tsx`: create detail route.
- GitNexus impact required before editing existing symbols: `STATIC_ADMIN_NAV_ITEMS`, `ROUTE_AUTHORIZATION_RULES`, `ADMIN_PATH_AUTHORIZATION_RULES`.

## Validation
- `bun check`
- `bun typecheck`
- route authorization targeted test
