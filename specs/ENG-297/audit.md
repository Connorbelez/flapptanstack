# Spec Audit: ENG-297 - Broker portal: establish portal registry and host-resolution context

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff against `main` (merge-base `2b458cf10d8fc6b0c78066ecf64811c900902ff1`, no PR yet)
- Last run: 2026-04-20T17:16:04Z
- Verdict: needs manual validation

# Spec Compliance Review

## Findings
- [low] The earlier audit gaps are addressed: duplicate-host rejection now runs in the portal write/backfill path, and the router query hash now consumes the resolved `portalCacheKey` before downstream loaders/components issue host-sensitive reads.
- [low] Release evidence is still incomplete at the repo level. `bunx convex codegen`, `bun typecheck`, and the focused ENG-297 Vitest suite are green, but `bun check` is still red on unrelated repo-wide complexity diagnostics, `coderabbit review --plain` still cannot run on the current 366-file diff, and the human multi-host browser checkpoint remains manual because the repo does not provide a multi-host localhost Playwright harness.

## Verdict
- needs manual validation

## Coverage Summary
- SATISFIED: 10
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 2

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | data model | Persist `portals`, `portalLandingPages`, `portalPricingPolicies`, and `users.homePortalId` | `convex/schema.ts`, `convex/brokers/migrations.ts` | Includes placeholder-table ownership comments and host lookup indexes |
| SATISFIED | backend behavior | Seed FairLend `app.*` portal and backfill broker/home portal assignments deterministically | `convex/brokers/migrations.ts`, `convex/portals/__tests__/registry.test.ts` | Test proves FairLend default, broker slug derivation, and borrower/default-user `homePortalId` assignment |
| SATISFIED | host contract | FairLend app host resolves through the same persisted registry contract as broker hosts | `convex/portals/queries.ts`, `convex/portals/__tests__/registry.test.ts` | `APP.localhost:3000` and `MERIDIAN.localhost:3000` both resolve via the registry query |
| SATISFIED | root context | Resolve serializable root `PortalContext` before child loaders and expose it in route context | `src/routes/__root.tsx`, `src/lib/portal/host-resolution.ts`, `src/lib/portal/request-host.ts` | Root `beforeLoad` resolves portal state after centralized host extraction and before child loaders run |
| SATISFIED | non-portal kinds | Preserve explicit `marketing`, `admin`, `reserved`, and `unknown` host kinds | `shared/portal/contracts.ts`, `src/lib/portal/host-resolution.ts`, `src/test/routes/portal-context.test.tsx` | Tests cover marketing, admin, reserved, and unknown classification paths |
| SATISFIED | fail-closed behavior | Unknown, reserved, suspended, and unpublished hosts fail closed with explicit root states | `src/components/portal/portal-state-boundary.tsx`, `src/routes/__root.tsx`, `src/test/routes/portal-context.test.tsx` | Boundary renders explicit blocked states and root redirects bad non-root requests back to `/` |
| SATISFIED | negative scope | Keep callback restoration, auth route redesign, pricing math, and CMS/editor work out of scope | No changes in `src/lib/auth-redirect.ts`, `src/routes/sign-in.tsx`, `src/routes/sign-up.tsx`, pricing/CMS modules | The implementation stays inside registry/root-context seams |
| SATISFIED | automated proof | Add focused route and Convex coverage for host parsing, registry lookup, seed/backfill, trusted request-host extraction, and root portal-context resolution | `convex/portals/__tests__/registry.test.ts`, `src/test/routes/portal-context.test.tsx` | The focused Vitest suite passes locally |
| SATISFIED | invariants | Unique lookup by production/local host and duplicate-host rejection | `convex/portals/invariants.ts`, `convex/brokers/migrations.ts`, `convex/portals/__tests__/registry.test.ts` | The write/backfill path now rejects conflicting portal claims and focused tests cover both write-time and read-time duplicates |
| SATISFIED | cache boundary | Make portal-sensitive same-path, cross-host reads host-aware enough to avoid cache bleed | `src/lib/portal/query-cache-scope.ts`, `src/router.tsx`, `src/routes/__root.tsx`, `src/test/routes/portal-query-cache-scope.test.ts` | The router query hash is now salted with the active `portalCacheKey` that root `beforeLoad` resolves and installs before child loaders/components run |
| UNVERIFIED | quality gates | `bunx convex codegen`, `bun check`, and `bun typecheck` all pass | Command reruns on 2026-04-20 | `bunx convex codegen` and `bun typecheck` passed; `bun check` is still blocked by unrelated repo-wide complexity diagnostics |
| UNVERIFIED | manual checkpoint | Multi-host browser behavior is proven on localhost/app.localhost/broker.localhost/unknown.localhost | Focused route + Convex tests only | The repo does not currently provide a multi-host Playwright harness, so the human checkpoint remains manual |

## Open Questions
- Whether ENG-297 should be considered mergeable before the repo-wide `bun check` debt is resolved or explicitly waived for this slice.
- `coderabbit review --plain` cannot be completed on the current diff because the tool rejects review targets over 300 files.
- The local GitNexus CLI does not expose `detect_changes`, so final scope verification uses `git diff` and file reconciliation instead of a graph-native change detector.
