# Spec Audit: ENG-352 - MIC portal: establish portal, RBAC, and MIC lender mapping contract

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff against `bf60c1d`
- Last run: 2026-04-25T22:58:00Z
- Verdict: needs manual validation

## Findings
- No `MISSING` or `CONTRADICTED` implementation gaps found against ENG-352.
- Manual validation remains for human-owned WorkOS/dashboard state: confirm the `micinvestor` role exists in WorkOS with only `mic:access`, seed/configure the MIC portal record with the real MIC org id and canonical lender auth id, and verify `mic.localhost:3000` in a running environment.

## Coverage summary
- SATISFIED: 16
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 3 manual checkpoints

## Requirement ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | portal contract | MIC is a first-class portal type | `convex/portals/validators.ts`, `convex/schema.ts` | Existing `fairlend` and `broker` remain valid. |
| SATISFIED | host resolution | `mic.localhost:3000` and `mic.fairlend.ca` resolve through registry lookup | `convex/portals/__tests__/registry.test.ts`, `shared/portal/contracts.ts` | No special-case host branch added. |
| SATISFIED | portal mapping | MIC portal stores `orgId` and explicit `micLenderAuthId` | `convex/schema.ts`, `convex/portals/helpers.ts`, `convex/portals/micConfig.ts` | Internal config resolver exposes lender mapping to protected consumers. |
| SATISFIED | fail-closed behavior | Missing/invalid MIC mapping does not fall back to org ownership | `convex/portals/micConfig.ts`, `convex/portals/__tests__/registry.test.ts` | Covers missing mapping, unpublished, suspended, and non-MIC portal cases. |
| SATISFIED | RBAC | `mic:access` exists in canonical catalog and WorkOS seed path | `convex/auth/permissionCatalog.ts`, `scripts/setup-workos-permissions.ts`, snapshot test | Admin role was not given `mic:access`. |
| SATISFIED | role contract | `micinvestor` only grants `mic:access` | `convex/auth/permissionCatalog.ts`, `src/test/auth/permissions/role-permission-matrix.test.ts` | No lender/broker/borrower/admin permissions granted. |
| SATISFIED | route auth | MIC route key requires `mic:access` and preserves admin wildcard | `src/lib/auth.ts`, `src/test/auth/route-guards.test.ts` | Unrelated `portfolio:view` is rejected. |
| SATISFIED | Convex visibility | New exported Convex function uses fluent builder and `.internal()` | `convex/portals/micConfig.ts` | No raw exported pseudo-endpoint added. |
| SATISFIED | tests | Targeted auth, portal, route, and contract tests pass | 160 targeted tests passed | Vitest reported a post-success Vite close timeout but exited 0. |
| UNVERIFIED | manual checkpoint | Real WorkOS `micinvestor` role exists with only `mic:access` | requires WorkOS dashboard check | Human-owned external state. |
| UNVERIFIED | manual checkpoint | Real MIC portal row is seeded with production org/lender ids | requires environment seed/config check | Code supports it; real ids are external. |
| UNVERIFIED | manual checkpoint | Browser confirms `mic.localhost:3000` resolves in dev | requires running app and seeded data | Downstream UI route is out of scope. |

## Unresolved items
- None blocking code readiness.
- Manual WorkOS and seeded-environment checks remain before operational rollout.

## Next action
- Human validates WorkOS role and seeded MIC portal configuration in the target environment.
