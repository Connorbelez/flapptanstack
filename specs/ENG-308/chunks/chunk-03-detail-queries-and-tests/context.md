# Chunk Context: chunk-03-detail-queries-and-tests

## Goal
- Publish the sheet-ready detail payload queries for positions and payments, then lock the contract down with focused backend tests and repo validation.
- Finish ENG-308 with validation and spec-audit evidence rather than leaving contract behavior implicit.

## Relevant plan excerpts
- "Publish explicit DTOs for cockpit metrics, positions rows, payment rows, actions-required items, broker limits, suggested opportunities, and both detail sheets."
- "Add backend tests for empty state, unauthorized access, mid-period ownership math, and individual-payment rows."
- "The command-center contract must expose sheet-ready detail payloads for the approved full-height position and payment sheets."
- "Add contract/query tests under `convex/portfolio/__tests__/queries.test.ts`."

## Implementation notes
- The position detail query should key off a mortgage the lender actually holds and return a sheet-ready payload without requiring downstream recomputation.
- The payment detail query should key off an individual obligation and include linked mortgage, borrower/payment metadata, latest status context, and connected escalation data when available.
- Tests should create lender/portal fixtures, position issuance, listing data, obligations, and collection attempts that exercise empty-state, unauthorized, and mid-period ownership scenarios.
- Keep the test module loading local to the new portfolio test if possible to minimize unrelated edits to existing shared test infrastructure.

## Existing code touchpoints
- `convex/auth/resourceChecks.ts`
- `convex/payments/adminDashboard/queries.ts`
- `convex/payments/cashLedger/queries.ts`
- `convex/portals/__tests__/middleware.test.ts`
- `convex/listings/__tests__/queries.test.ts`
- `src/test/auth/helpers.ts`

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- `bun run test -- convex/portfolio/__tests__/queries.test.ts convex/accrual/__tests__/queryHelpers.test.ts convex/ledger/__tests__/queries.test.ts`
- `$linear-pr-spec-audit`
