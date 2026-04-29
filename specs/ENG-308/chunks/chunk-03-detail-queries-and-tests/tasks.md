# Chunk: chunk-03-detail-queries-and-tests

- [x] T-200: Implement the position-detail sheet payload query keyed by `{ portalId, mortgageId }`
- [x] T-210: Implement the payment-detail sheet payload query keyed by `{ portalId, obligationId }`
- [x] T-300: Add `convex/portfolio/__tests__/queries.test.ts` covering the required contract scenarios
- [x] T-310: Add or update regression coverage for any extracted shared helper behavior that changes lender portal listing constraints or query composition
- [x] T-900: Run `bunx convex codegen`, `bun check`, and `bun typecheck`
- [x] T-910: Run focused tests: `bun run test -- convex/portfolio/__tests__/queries.test.ts convex/accrual/__tests__/queryHelpers.test.ts convex/ledger/__tests__/queries.test.ts`
- [x] T-980: Run `$linear-pr-spec-audit` against the current branch diff for ENG-308
- [x] T-990: Resolve audit findings or record blockers in `specs/ENG-308/audit.md`
