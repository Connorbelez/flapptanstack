# ENG-358 Chunk Manifest

## Chunk 01: Seed And Backend

- Scope: deterministic MIC seed helper, Convex portfolio query assertions, request approval/provisioning integration tests.
- Files expected: `src/test/convex/mic/seedMicScenario.ts`, `src/test/convex/micPortfolio/*.test.ts`, `src/test/convex/micInvestorAccessRequests/*.test.ts`.
- Risk: medium. The fixture touches core schema tables and ledger helper APIs, but should avoid changing shipped query/provisioning symbols unless tests reveal a defect.

## Chunk 02: Frontend And E2E

- Scope: route/component hardening and Playwright coverage for MIC host, public request, protected route states, and dashboard smoke behavior.
- Files expected: `src/test/mic/*.test.tsx`, `src/test/routes/*.test.tsx`, `e2e/mic/*.spec.ts`, `playwright.config.ts`, `e2e/helpers/*`.
- Risk: medium-high. Host-aware auth and route protection have broad integration surface; keep app code edits minimal and prefer tests around existing contracts.

## Order

1. Complete Chunk 01 first so frontend and E2E tests can consume a stable scenario contract.
2. Complete Chunk 02 after backend fixture and expected dashboard values are settled.
3. Run full validation and update this manifest with any intentional scope changes.
