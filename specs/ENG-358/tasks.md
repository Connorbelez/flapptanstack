# ENG-358: MIC Seed Scenario and E2E Hardening

## Source

- Linear: ENG-358 - MIC portal: seed realistic MIC scenario and harden E2E
- Notion: Implementation Plan: ENG-358 - MIC seed scenario and E2E hardening
- Dependencies: ENG-354, ENG-355, ENG-356, ENG-357

## Requirements

- Seed a deterministic MIC scenario with an active MIC portal, explicit MIC lender mapping, an invited/approved investor, admin user, request lifecycle data, listings, mortgage participation, and posted ledger position balances.
- Include at least two active or funded MIC deals, multiple position accounts, and one excluded non-MIC lender position.
- Reuse the same seed helper across Convex tests and E2E setup.
- Cover public request intake, admin approval/provisioning with mocked WorkOS, protected `/portal` behavior, and dashboard totals/rows derived from MIC ledger positions.
- Assert non-goals: no personalized holdings, no cap table, no cash/reserve/treasury metrics, and no non-MIC lender data.

## Tasks

- [ ] Add `src/test/convex/mic/seedMicScenario.ts` with a deterministic end-to-end MIC scenario fixture.
- [ ] Add Convex query coverage for `micPortfolio` using the shared fixture, including two MIC positions and one excluded non-MIC lender position.
- [ ] Add Convex lifecycle coverage that ties public request creation, admin approval, provisioning mocks, and approved investor user state together.
- [ ] Harden MIC component/route tests around hidden unsupported metrics and row rendering from realistic seeded query output.
- [ ] Add Playwright MIC project/config helpers for `mic.localhost:3000`, public request flow, protected route states, and dashboard smoke coverage where local auth fixtures allow.
- [ ] Document fixture intent near the fixture entry point.
- [ ] Run `bun check`, `bun typecheck`, `bunx convex codegen`, targeted Vitest, and relevant Playwright tests.

## Notes

- Existing contracts already include `micPortalFields`, `resolveMicPortalConfig`, `submitPublicRequest`, `approveRequest`, WorkOS provisioning test override, `/portal` route guard, MIC dashboard query options, and MIC dashboard components.
- `getMicDashboardSnapshot` currently uses `Date.now()` inside a query. Do not expand that pattern; if touched, move toward a deterministic/query-safe time source.
