# Tasks: ENG-356 - MIC portal: implement ledger-derived portfolio query contracts

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Finalize execution artifacts and chunk plan.
- [x] T-002: Run GitNexus impact for existing symbols touched or depended on before code edits.

## Phase 2: Contracts
- [x] T-010: Add `convex/micPortfolio/contracts.ts` with typed validators for envelopes, metrics, rows, detail, payments, concentration, filters, and warnings.
- [x] T-011: Add local MIC portfolio contract types with no `any` shortcuts and explicit `sourceOfTruth` literal.

## Phase 3: Query Implementation
- [x] T-020: Add `convex/micPortfolio/queries.ts` public fluent queries guarded by `authMiddleware`, `requirePermission("mic:access")`, and MIC portal config resolution.
- [x] T-021: Add MIC-specific helper logic to load positive posted position accounts by canonical `micLenderAuthId` without changing shared lender portfolio helpers.
- [x] T-022: Build dashboard, positions, detail, payments/history, concentration, maturity ladder, weighted averages, arrears/delinquency exposure, and incomplete cash-ledger warnings from ledger/mortgage/payment records only.
- [x] T-023: Register the new MIC portfolio modules in `convex/test/moduleMaps.ts` if the test harness requires explicit module loading.

## Phase 4: Tests
- [x] T-030: Add `convex/micPortfolio/__tests__/queries.test.ts` fixtures for MIC portal, canonical lender ledger positions, unrelated lender positions, mortgage/property/payment context, and portal failures.
- [x] T-031: Cover happy path, empty positions, missing mapping, inactive/unpublished portal, missing permission, non-MIC lender exclusion, and unsupported cash metric absence.
- [x] T-032: Run targeted MIC portfolio tests and existing lender portfolio tests.

## Phase 5: Validation And Audit
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run relevant unit test suite.
- [x] T-910: Run `$linear-pr-spec-audit`.
- [x] T-920: Resolve audit findings or record blockers.
- [x] T-930: Run final execution artifact validation and GitNexus change detection.
