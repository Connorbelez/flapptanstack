# Status: chunk-03-detail-queries-and-tests

- Result: complete
- Last updated: 2026-04-21T19:17:01Z

## Completed tasks
- T-200: Added the lender position detail query keyed by `{ portalId, mortgageId }`.
- T-210: Added the lender payment detail query keyed by `{ portalId, obligationId }`.
- T-300: Added focused portfolio query tests for empty-state safety, unauthorized access, ordered suggestions, broker context, ownership math, and payment-row/detail behavior.
- T-310: Revalidated shared portal listing constraints with the existing lender portal listing query suite after extraction.
- T-900: Ran `bunx convex codegen`, `bun check`, and `bun typecheck`.
- T-910: Ran the focused portfolio, accrual, and ledger backend tests.
- T-980: Completed the final spec-compliance audit against the local ENG-308 branch diff.
- T-990: Audit closed with no missing or contradicted requirements.

## Validation
- `bunx convex codegen`: passed
- `bun check`: passed with pre-existing out-of-scope complexity warnings elsewhere in the repo
- `bun typecheck`: passed
- `bun run test -- convex/portfolio/__tests__/queries.test.ts convex/accrual/__tests__/queryHelpers.test.ts convex/ledger/__tests__/queries.test.ts`: passed
- `$linear-pr-spec-audit`: passed

## Notes
- Detail queries should remain thin readers over the same source-of-truth helpers used by the main command-center query so sheet payloads do not drift from table rows.
