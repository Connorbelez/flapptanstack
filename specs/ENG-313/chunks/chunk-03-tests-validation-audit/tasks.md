# Chunk: chunk-03-tests-validation-audit

- [x] T-030: Update `src/components/lender/portfolio/fixtures.ts` and `src/components/lender/portfolio/LenderPortfolioPage.stories.tsx` for cockpit/export-strip states.
- [x] T-031: Add focused cockpit/export component coverage in `src/test/lender/portfolio-cockpit.test.tsx`.
- [x] T-032: Decide whether dedicated Playwright coverage is practical and record the outcome.
  - The current `e2e` harness establishes authenticated browser storage but does not seed deterministic lender-portfolio data, so dedicated Playwright coverage for `/lender/portfolio` would be brittle and duplicative for this issue.
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
  - `bun check` now passes after fixing the cockpit Biome error; it still reports unrelated pre-existing complexity warnings in untouched Convex modules.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted tests for the touched scope.
  - Final targeted validation included `src/test/lender/portfolio-cockpit.test.tsx`, `src/test/routes/lender-portfolio-route.test.tsx`, `convex/portfolio/__tests__/export.test.ts`, and `convex/portfolio/__tests__/snapshots.test.ts`.
- [x] T-904: Run the relevant broader tests or record why additional E2E coverage is not practical.
  - Broader coverage came from `src/test/routes/lender-portfolio-route.test.tsx` and `convex/portfolio/__tests__/export.test.ts`, which cover the route seam and the ENG-310 export contract.
- [x] T-910: Run `$linear-pr-spec-audit` against the current branch diff for `ENG-313`.
- [x] T-920: Resolve audit findings or record blockers, then rerun the audit if needed.
  - The missing projection surface and validation concern were fixed inside this issue, and the rerun audit is `ready`.
