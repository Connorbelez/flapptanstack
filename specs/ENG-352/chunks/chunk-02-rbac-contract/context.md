# Chunk Context: chunk-02-rbac-contract

## Goal
- Add MIC authorization as a canonical RBAC contract using WorkOS permissions and existing route authorization helpers.

## Relevant plan excerpts
- Permission: `mic:access`.
- Role: `micinvestor -> ["mic:access"]`.
- `admin:access` remains the admin super-permission and must satisfy checks through existing wildcard behavior; do not add `mic:access` to the admin WorkOS role as a substitute.

## Implementation notes
- Keep `micinvestor` isolated from lender, broker, borrower, and admin permissions.
- Update catalog metadata and seeding script together so WorkOS and in-app tests cannot drift.
- Add a route authorization key for downstream MIC protected surfaces without building the route UI in this issue.

## Existing code touchpoints
- `convex/auth/permissionCatalog.ts`: permission metadata and `ROLE_PERMISSIONS`.
- `scripts/setup-workos-permissions.ts`: WorkOS permission sync.
- `src/lib/auth.ts`: `ROUTE_AUTHORIZATION_RULES` and permission helpers.
- `src/test/auth/permissions/*`: catalog sync and matrix tests.
- `src/test/routes/*`: route authorization tests.

## Validation
- Permission metadata sync tests must pass.
- Route authorization tests must prove `mic:access` passes, unrelated permissions fail, and `admin:access` passes by wildcard behavior.
