# Chunk 02: Frontend And E2E

## Goal

Harden the MIC portal route and E2E smoke coverage around the realistic scenario from Chunk 01.

## Tasks

- [ ] Extend MIC dashboard/component tests to render realistic seeded query output.
- [ ] Assert dashboard rows, headline totals, warnings, maturity/concentration sections, and absence of unsupported v1 metrics.
- [ ] Extend route guard tests for authenticated authorized user, unauthenticated redirect, wrong-organization/wrong-permission denial, and query error states.
- [ ] Add Playwright coverage for `mic.localhost:3000` public landing/request flow.
- [ ] Add Playwright coverage for `/portal` protected states using existing host-aware auth/storage helpers.
- [ ] Add a dashboard smoke assertion that verifies seeded deal labels and excludes non-MIC lender data where auth fixtures are available.
- [ ] Keep host-aware setup compatible with existing Playwright projects and storage state conventions.

## Verification

- `bun test src/test/mic src/test/routes`
- `bun run test:e2e -- --project=chromium-mic` or the nearest relevant existing MIC project if project names differ.
- `bun check`
- `bun typecheck`
