# Spec Audit: ENG-355 - MIC portal: enforce protected route and host-aware auth boundary

- Audit skill: `$linear-pr-spec-audit`
- Review target: local branch diff against current base
- Last run: 2026-04-26T01:24:00Z
- Verdict: needs manual validation

## Findings
- none

## Unresolved items
- none

## Next action
- Manual human checkpoint remains for the live WorkOS browser flow: seed an active MIC portal and a user with `mic:access`, then verify sign-in/callback on `mic.localhost:3000`.

## Coverage Summary
- SATISFIED: 14
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 1
- OUT_OF_SCOPE: 2

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | route policy | Public MIC root `/` remains accessible on active MIC portal hosts | `src/lib/portal/route-host-policy.ts`, `src/test/routes/route-host-policy.test.ts`, `src/test/routes/portal-home-route.test.tsx` | Root remains `shared`; `/portal` is registered separately. |
| SATISFIED | route policy | `/portal` is classified as `portal` | `src/lib/portal/route-host-policy.ts`, `src/test/routes/route-host-policy.test.ts` | Registered before `/` catchall. |
| SATISFIED | host boundary | `/portal` requires active portal context and fails closed for blocked hosts | `src/routes/__root.tsx`, `src/test/routes/root-route-blocked-hosts.test.ts` | Added `/portal` blocked-host and marketing-host assertions. |
| SATISFIED | auth | `/portal` requires authentication | `src/routes/portal.tsx`, `src/test/routes/mic-portal-route.test.tsx` | Signed-out visitors redirect to `/sign-in?redirect=/portal`. |
| SATISFIED | authz | `/portal` requires `mic:access`; unrelated permissions are insufficient | `src/lib/auth.ts`, `src/test/auth/route-guards.test.ts`, `src/test/routes/mic-portal-route.test.tsx` | Lender, broker, borrower, and portfolio-only cases are denied. |
| SATISFIED | authz | `admin:access` passes through existing super-permission behavior only | `src/lib/auth.ts`, `src/test/auth/route-guards.test.ts`, `src/test/routes/mic-portal-route.test.tsx` | No custom admin bypass was added. |
| SATISFIED | auth readiness | Protected route uses `Authenticated` / `AuthLoading` before content mounts | `src/routes/portal.tsx`, `src/test/routes/mic-portal-route.test.tsx` | Loading-state test proves protected content is not mounted. |
| SATISFIED | query safety | Protected shell does not mount Convex suspense query consumers | `src/routes/portal.tsx` | Shell only reads route context and active portal id. |
| SATISFIED | sign-in return | MIC public root sign-in returns to `/portal` on the MIC host | `src/routes/index.tsx`, `src/test/routes/portal-home-route.test.tsx` | Existing relative redirect keeps the originating host. |
| SATISFIED | wrong host | Marketing/wrong host portal route requests are redirected to host boundary | `src/test/routes/route-host-policy.test.ts`, `src/test/routes/root-route-blocked-hosts.test.ts` | `/portal` has explicit host-boundary coverage. |
| SATISFIED | route shell | Approved MIC investor can render protected shell | `src/routes/portal.tsx`, `src/test/routes/mic-portal-route.test.tsx` | Guard accepts `mic:access`; shell renders active portal id. |
| SATISFIED | existing route regression | Broker/listings/lender route tests still pass | `bun run test` full-suite output | Relevant route tests passed in the full suite; full suite has unrelated AMPS failures noted in status. |
| SATISFIED | validation | `bunx convex codegen`, `bun check`, and `bun typecheck` pass | local command outputs | `bun check` reports pre-existing warnings but exits 0. |
| SATISFIED | forbidden scope | No dashboard query, public request intake, provisioning, or `PortalBuilder` changes | local diff | Implementation is limited to route/auth/policy/tests. |
| UNVERIFIED | manual flow | Live WorkOS sign-in/callback on `mic.localhost:3000` restores host and `/portal` after authentication | Manual checkpoint required | Automated unit/route tests cover redirect construction; live AuthKit browser flow remains human validation. |
| OUT_OF_SCOPE | e2e | Full WorkOS browser journey | Linear plan | Deferred to ENG-358. |
| OUT_OF_SCOPE | Storybook | Reusable UI stories | Implementation shape | No reusable component or dashboard UI introduced. |
