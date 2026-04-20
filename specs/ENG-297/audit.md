# Spec Audit: ENG-297 - Broker portal: establish portal registry and host-resolution context

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff against `test-fixes-1` (Graphite parent, no PR yet)
- Last run: 2026-04-20T20:15:50Z
- Verdict: needs manual validation

# Spec Compliance Review

## Findings
- [low] Release evidence is still incomplete against the explicit definition-of-done gates. `bunx convex codegen`, `bun typecheck`, and the focused ENG-297 Vitest suite are green, but `bun check` is still red on unrelated repo-wide complexity warnings, and the human multi-host localhost checkpoint remains manual because the repo does not provide a multi-host Playwright harness.

## Verdict
- needs manual validation

## Coverage Summary
- SATISFIED: 11
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 2

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | data model | Persist `portals`, placeholder attachment tables, and `users.homePortalId` with the required lookup indexes | `convex/schema.ts`, `convex/brokers/migrations.ts` | Includes `by_slug`, host, broker, org, and status indexes plus placeholder downstream-owned attachment tables |
| SATISFIED | backend behavior | Seed the FairLend `app.*` portal row and backfill broker and default-user home portals deterministically | `convex/brokers/migrations.ts`, `convex/portals/__tests__/registry.test.ts` | Tests prove FairLend defaulting, broker slug derivation, and `homePortalId` assignment |
| SATISFIED | host contract | Resolve FairLend and broker portals from persisted production/local hosts, with lowercase normalization and duplicate-host rejection | `shared/portal/contracts.ts`, `convex/portals/invariants.ts`, `convex/portals/__tests__/registry.test.ts` | Mixed-case lookup normalizes, reserved hosts are rejected, and duplicate portal claims throw |
| SATISFIED | root context contract | Keep the root `PortalContext` as the blessed minimal public pre-auth routing contract | ENG-297 issue description updated on 2026-04-20, `convex/portals/validators.ts`, `convex/portals/queries.ts`, `src/lib/portal/host-resolution.ts` | Public root context now exposes only host identity, portal identity, availability, and cache-scoping data; privileged portal metadata stays downstream behind authenticated or admin-scoped lookups |
| SATISFIED | local host standards | Treat `localhost:3000` as marketing, `app.localhost:3000` as the FairLend portal, and `<portal>.localhost:3000` as broker hosts | `shared/portal/contracts.ts`, `src/lib/portal/host-resolution.ts`, `convex/portals/__tests__/registry.test.ts`, `src/test/routes/portal-context.test.tsx` | No `127.0.0.1` support was added |
| SATISFIED | request-host trust boundary | Extract the request host once in a shared seam and only trust `x-forwarded-host` behind explicit configuration | `src/lib/portal/request-host.ts`, `src/test/routes/portal-context.test.tsx` | The env gate closes the spoofing risk from the earlier review finding |
| SATISFIED | fail-closed behavior | Unknown, reserved, suspended, and unpublished hosts fail closed rather than falling back to marketing | `src/routes/__root.tsx`, `src/components/portal/portal-state-boundary.tsx`, `src/test/routes/portal-context.test.tsx` | Non-root requests redirect to `/`, and the root shell renders explicit blocked states |
| SATISFIED | route-level proof | Prove at the route level that blocked hosts keep `/` inert and redirect non-root paths before child loaders can run | `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/test/routes/root-route-blocked-hosts.test.ts` | The test exercises the real exported route modules, confirms root `beforeLoad` returns the blocked context on `/`, confirms the `/` route has no child loader, and confirms blocked non-root requests redirect before child loaders can run |
| SATISFIED | cache boundary | Salt query caching with the resolved portal cache key to prevent same-path cross-host cache bleed | `src/lib/portal/query-cache-scope.ts`, `src/router.tsx`, `src/test/routes/portal-query-cache-scope.test.ts` | Identical query keys hash differently across portal scopes |
| SATISFIED | negative scope | Keep callback restoration, portal membership middleware, pricing math, and CMS/editor work out of scope | Diff against `test-fixes-1`, unchanged auth callback routes/helpers | The branch stays inside registry, root-context, and cache-boundary seams |
| SATISFIED | focused automated proof | Add focused Convex and route coverage for registry lookup, backfill, host parsing, root-context helpers, cache scoping, and blocked-host routing behavior | `convex/portals/__tests__/registry.test.ts`, `src/test/routes/portal-context.test.tsx`, `src/test/routes/portal-query-cache-scope.test.ts`, `src/test/routes/root-route-blocked-hosts.test.ts` | `bun run test -- convex/portals/__tests__/registry.test.ts src/test/routes/portal-context.test.tsx src/test/routes/portal-query-cache-scope.test.ts src/test/routes/root-route-blocked-hosts.test.ts` passed |
| UNVERIFIED | quality gates | `bunx convex codegen`, `bun check`, and `bun typecheck` all pass | command reruns on 2026-04-20 | `bunx convex codegen` and `bun typecheck` passed; `bun check` still fails on unrelated repo-wide complexity warnings |
| UNVERIFIED | manual checkpoint | Browser-level multi-host behavior is proven on localhost, app.localhost, broker.localhost, and an unknown broker host | Focused unit/integration coverage only | The repo does not currently provide a multi-host localhost Playwright harness, so the human checkpoint remains manual |

## Open Questions
- Whether the repo-wide `bun check` failure is acceptable debt for merging ENG-297, or whether this slice needs an explicit waiver before it can be treated as definition-of-done complete.
- CodeRabbit review is human-owned and not part of the agent quality gate for this repo.
