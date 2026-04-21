# Tasks: ENG-308 - Lender portfolio: establish command-center contracts and source-of-truth rules

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Finalize implementation task list, chunk plan, and execution artifacts for ENG-308

## Phase 2: Shared Contracts
- [x] T-010: Extract reusable lender portal constraint helpers so portfolio suggestions and limits reuse the same constraint logic as lender portal listings
- [x] T-020: Define portfolio DTO validators and TypeScript contracts in `convex/portfolio/contracts.ts`
- [x] T-030: Add shared portfolio composition helpers in `convex/portfolio/helpers.ts` for cockpit, positions, payments, suggestions, limits, and broker coordination aggregation

## Phase 3: Command-Center Query
- [x] T-100: Implement the main public portfolio command-center read in `convex/portfolio/queries.ts` using `portalLenderQuery`
- [x] T-110: Return stable empty-state-safe payloads for cockpit, positions, payment activity, action-required items, broker limits, suggested opportunities, and broker coordination context

## Phase 4: Detail Queries
- [x] T-200: Implement the position-detail sheet payload query keyed by `{ portalId, mortgageId }`
- [x] T-210: Implement the payment-detail sheet payload query keyed by `{ portalId, obligationId }`

## Phase 5: Tests
- [x] T-300: Add `convex/portfolio/__tests__/queries.test.ts` covering empty-state safety, unauthorized portal access, mid-period ownership math, individual payment rows, ordered suggestions, and broker context
- [x] T-310: Add or update regression coverage for any extracted shared helper behavior that changes lender portal listing constraints or query composition

## Phase 6: Validation
- [x] T-900: Run `bunx convex codegen`, `bun check`, and `bun typecheck`
- [x] T-910: Run focused tests: `bun run test -- convex/portfolio/__tests__/queries.test.ts convex/accrual/__tests__/queryHelpers.test.ts convex/ledger/__tests__/queries.test.ts`

## Phase 9: Audit
- [x] T-980: Run `$linear-pr-spec-audit` against the current branch diff for ENG-308
- [x] T-990: Resolve audit findings or record blockers in `specs/ENG-308/audit.md`
