# Status: chunk-02-borrower-write-paths

- Result: complete
- Last updated: 2026-04-20 22:01:46 EDT

## Completed tasks
- T-030: Propagate `borrowers.portalId` through canonical borrower provisioning in `convex/borrowers/resolveOrProvisionForOrigination.ts`
- T-040: Wire borrower portal attribution through admin origination entry points, seeds, and direct insert helpers (`convex/admin/origination/*`, `convex/seed/*`, targeted test harnesses)

## Validation
- `bunx convex codegen`: pass
- `bun run test -- src/test/convex/admin/origination/commit.test.ts src/test/convex/seed/seedAll.test.ts`: pass

## Notes
- Canonical borrower uniqueness remains org-based in the current branch. If explicit attribution exposes a same-org cross-portal collision, fail closed rather than silently reusing the wrong borrower row.
- Work started on 2026-04-20 after chunk 01 passed codegen and targeted onboarding tests.
- Canonical provisioning now resolves/patches explicit borrower portal attribution, origination collections forwards portal context from the staged case, and seed borrowers default to the FairLend app portal.
