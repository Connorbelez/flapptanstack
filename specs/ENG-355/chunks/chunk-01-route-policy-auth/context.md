# Chunk Context: chunk-01-route-policy-auth

## Goal
- Make `/portal` a portal-host route and verify `micPortal` authorization uses `mic:access`.

## Relevant plan excerpts
- `ROUTE_AUTHORIZATION_RULES.micPortal = { kind: "permission", permission: "mic:access" }`
- `GET /portal on mic.<domain> -> requires active portal host + WorkOS authentication + mic:access`
- `/portal` must appear before `/` catchall.

## Implementation notes
- `src/lib/auth.ts` already contains `ISLAND_PERMISSIONS.mic` and `ROUTE_AUTHORIZATION_RULES.micPortal`.
- `src/lib/portal/route-host-policy.ts` currently falls `/portal` through to `/` and returns `shared`.
- Use shared `canAccessRoute` / `guardRouteAccess` behavior; no custom admin bypass.

## Existing code touchpoints
- `src/lib/portal/route-host-policy.ts`: add `{ prefix: "/portal", policy: "portal" }`.
- `src/lib/auth.ts`: verify no change is needed for `micPortal`.
- `src/test/routes/route-host-policy.test.ts`: add `/portal` classification and host-boundary cases.
- `src/test/auth/route-guards.test.ts`: already has `micPortal` permission tests; extend only if needed.
- GitNexus impact:
  - `resolveRouteHostPolicy`: LOW, 2 direct dependents.
  - `ROUTE_AUTHORIZATION_RULES`: LOW, no indexed upstream dependents.

## Validation
- `bun test src/test/routes/route-host-policy.test.ts src/test/auth/route-guards.test.ts`
