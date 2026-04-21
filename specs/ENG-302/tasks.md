# Tasks: ENG-302 - Broker portal: add explicit borrower portal attribution on onboarding and borrower records

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Finalize implementation task list and chunk plan against the live broker-portal branch
- [x] T-002: Validate execution artifacts at `ready-to-edit`

## Phase 2: Schema And Onboarding
- [x] T-010: Add `portalId` fields and supporting indexes to `borrowers` and `onboardingRequests` in `convex/schema.ts`
- [x] T-020: Persist `onboardingRequests.portalId` in `convex/onboarding/mutations.ts` from trusted portal context and update onboarding tests/helpers

## Phase 3: Borrower Write Paths
- [x] T-030: Propagate `borrowers.portalId` through canonical borrower provisioning in `convex/borrowers/resolveOrProvisionForOrigination.ts`
- [x] T-040: Wire borrower portal attribution through admin origination entry points, seeds, and direct insert helpers (`convex/admin/origination/*`, `convex/seed/*`, targeted test harnesses)

## Phase 4: Backfill And Cutover
- [x] T-050: Implement deterministic onboarding and borrower portal attribution backfill with unresolved reporting in `convex/brokers/migrations.ts` or an extracted helper module
- [x] T-060: Update `convex/portals/homePortalAssignment.ts` to prefer explicit borrower attribution while keeping safe fallback for unresolved legacy rows
- [x] T-070: Cut `convex/portals/middleware.ts:resolvePortalBorrower` over to explicit borrower `portalId` and update related proof/middleware behavior
- [x] T-080: Update targeted tests for onboarding, origination, migrations, seeds, and wrong-portal denial coverage

## Phase 5: Validation
- [x] T-900: Run `bunx convex codegen`, `bun check`, `bun typecheck`, and targeted portal/onboarding/borrower test suites

## Phase 6: Audit
- [x] T-910: Run `$linear-pr-spec-audit` against the current branch diff
- [x] T-920: Resolve audit findings or record blockers, then rerun final artifact validation
