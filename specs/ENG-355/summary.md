# Summary: ENG-355 - MIC portal: enforce protected route and host-aware auth boundary

- Source issue: https://linear.app/fairlend/issue/ENG-355/mic-portal-enforce-protected-route-and-host-aware-auth-boundary
- Primary plan: https://www.notion.so/34efc1b440248110bb46ee9aaa41861a
- Supporting docs:
  - https://www.notion.so/33ffc1b4402481f3b1f5d84c9cf98b0b

## Scope
- Add `/portal` as a portal-host route policy before the root catchall.
- Ensure the route auth registry exposes `micPortal` with `mic:access` and existing admin super-permission behavior.
- Add a TanStack route for `/portal` that runs `guardRouteAccess("micPortal")` and renders only inside Convex `Authenticated` / `AuthLoading` gates.
- Keep the `/portal` shell query-free so no Convex suspense query can mount before auth readiness.
- Update the public MIC root sign-in CTA to return to `/portal` on the same host while keeping non-MIC broker/fairlend root behavior stable.
- Add focused route/auth tests for policy classification, sign-in return behavior, protected shell gating, permission denial, admin override, wrong host, and inactive portal fail-closed behavior.

## Constraints
- Public MIC root `/` must remain accessible to unauthenticated visitors on active MIC portal hosts.
- `/portal` must be classified as `portal`, not shared, marketing, or admin.
- `/portal` must fail closed for reserved, unknown, suspended, archived, draft, unpublished, and misconfigured portal hosts through the existing host-boundary/root logic.
- Route permission is `mic:access`; `portfolio:view`, `lender:access`, `broker:access`, and `borrower:access` are insufficient.
- `admin:access` may pass only through existing permission grant helpers; do not add a custom route bypass.
- Do not modify `PortalBuilder` or global host resolution helpers unless new impact analysis is run.
- GitNexus impact before edits:
  - `resolveRouteHostPolicy`: LOW, 2 direct dependents (`route-host-policy.test.ts`, `auth-initiation.ts`), no affected indexed processes.
  - `ROUTE_AUTHORIZATION_RULES`: LOW, no indexed upstream dependents.
  - `HomeContent`: LOW, no indexed upstream dependents.
  - `ListingsLayout`: LOW, no indexed upstream dependents.

## Open questions
- none
