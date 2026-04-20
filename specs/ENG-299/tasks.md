# Tasks: ENG-299 - Broker portal: enforce portal membership in Convex middleware

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Finalize the execution task list, chunk plan, and artifact state for the `ENG-297`-based implementation branch
- [x] T-005: Run GitNexus analysis and upstream impact checks for `authMiddleware`, `requireOrgContext`, `canAccessMortgage`, and portal query seams before editing

## Phase 2: Implementation
- [x] T-010: Extract shared actor-resolution helpers from `convex/auth/resourceChecks.ts` into a reusable auth module without changing existing resource ownership semantics
- [x] T-020: Create `convex/portals/middleware.ts` to reload portal state from a trusted portal identifier and fail closed for unavailable portals
- [x] T-030: Add `requirePortalAccess`, `requirePortalLender`, and `requirePortalBorrower` middleware stages with typed portal and actor context
- [x] T-040: Extend `convex/fluent.ts` with portal-aware builders for public, authenticated, lender, and borrower portal functions
- [x] T-050: Add the minimal portal query surface needed by the middleware and a thin proof consumer that exercises the new builders without broad product rewrites
- [x] T-060: Update `convex/auth/resourceChecks.ts` and related wrappers to reuse shared actor-resolution helpers while keeping portal membership outside resource checks

## Phase 3: Tests And Validation
- [x] T-070: Add portal middleware tests for same-portal success, cross-portal denial, admin override, unavailable portals, and attribution mismatches
- [x] T-080: Update existing resource access tests to verify extracted actor-resolution helpers do not change resource-scoped behavior
- [x] T-900: Run `bunx convex codegen`
- [x] T-901: Run `bun check`
- [x] T-902: Run `bun typecheck`
- [x] T-903: Run targeted portal middleware and resource access tests
- [x] T-904: Run `coderabbit review --plain`

## Phase 9: Audit
- [x] T-910: Run `$linear-pr-spec-audit` against the current branch diff
- [x] T-920: Resolve audit findings or record blockers in `specs/ENG-299/audit.md`
- [x] T-930: Run final execution artifact validation for `ENG-299`
