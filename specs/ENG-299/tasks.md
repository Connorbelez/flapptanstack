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
- [x] T-045: Convert portal-aware builders into structural fluent-convex extensions so handlers receive portal context from the builder rather than manual proof-layer composition
- [x] T-046: Tighten `resolvePortalLender` so lender access is keyed only off broker alignment with the current portal
- [x] T-047: Tighten `resolvePortalBorrower` to the transitional deterministic `borrowers.orgId -> portals.by_org` mapping and document the `ENG-302` handoff
- [x] T-050: Add the minimal portal query surface needed by the middleware and a thin proof consumer that exercises the new builders without broad product rewrites
- [x] T-051: Rewrite `convex/portals/proof.ts` so proof consumers rely on builder-injected portal context instead of manual helper calls
- [x] T-060: Update `convex/auth/resourceChecks.ts` and related wrappers to reuse shared actor-resolution helpers while keeping portal membership outside resource checks

## Phase 3: Tests And Validation
- [x] T-070: Add portal middleware tests for same-portal success, cross-portal denial, admin override, unavailable portals, and attribution mismatches
- [x] T-071: Extend portal middleware proof coverage for builder-injected context, missing and unmapped borrower orgs, and same-org wrong-broker lenders
- [x] T-080: Update existing resource access tests to verify extracted actor-resolution helpers do not change resource-scoped behavior
- [x] T-905: Rerun `bunx convex codegen` for the audit remediation pass
- [x] T-906: Rerun `bun check` for the audit remediation pass
- [x] T-907: Rerun `bun typecheck` for the audit remediation pass
- [x] T-908: Rerun targeted portal middleware and resource access tests for the audit remediation pass
- [x] T-909: Confirm CodeRabbit review is human-owned and removed from the agent quality gate for this issue

## Phase 9: Audit
- [x] T-911: Verify `ENG-299` Linear and Notion wording already defers explicit borrower portal attribution to `ENG-302`
- [x] T-912: Rerun `$linear-pr-spec-audit` against the current branch diff
- [x] T-920: Resolve audit findings or record blockers in `specs/ENG-299/audit.md`
- [x] T-931: Run final execution artifact validation for `ENG-299`
