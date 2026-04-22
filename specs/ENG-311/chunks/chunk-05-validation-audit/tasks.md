# Chunk: chunk-05-validation-audit

- [x] T-043: Extend the payment activity route search seam and ledger UI to support the approved due-date range filter.
- [x] T-044: Add explicit `/lender/portfolio` unauthorized-access coverage alongside the existing route seam tests.
- [x] T-045: Resolve the current `bun check` blockers so the repo validation gate passes cleanly again.
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run `bun run test -- src/test/routes/lender-portfolio-route.test.tsx`.
- [x] T-904: Run the relevant broader tests, including `bun run test:e2e` if the final route behavior is practical to exercise through the existing Playwright harness.
- [x] T-905: Re-run `bun run test -- src/test/routes/lender-portfolio-route.test.tsx` after the audit-fix pass.
- [x] T-910: Run `$linear-pr-spec-audit` against the current branch diff for `ENG-311`.
- [x] T-920: Resolve audit findings or record blockers, then rerun the audit if needed.
