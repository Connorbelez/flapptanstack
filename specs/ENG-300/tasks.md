# Tasks: ENG-300 - Broker portal: define the v1 portal pricing policy contract

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Gather Linear and Notion context, confirm the flat broker-cut decision, and translate the issue contract into execution artifacts
- [x] T-002: Scaffold `specs/ENG-300` with the shared `linear-implement-v2` scripts and define the chunk plan
- [x] T-003: Run GitNexus analyze plus pre-edit impact checks for the listing query and shared rounding surfaces; record schema-level blind spots if the CLI cannot resolve them directly

## Phase 2: Contract And Schema
- [x] T-010: Tighten `convex/schema.ts` so `portalPricingPolicies` carries the explicit v1 broker-cut contract plus the minimum lifecycle fields and indexes needed for deterministic selection
- [x] T-011: Extend `convex/portals/validators.ts` with typed pricing-policy validators and status unions that match the hardened schema

## Phase 3: Pricing Helper And Selection
- [x] T-020: Create `convex/portals/pricing.ts` with policy validation, active-policy resolution, published-vs-unpublished behavior, and the importable projection helper
- [x] T-021: Reuse one shared two-decimal rounding helper for portal pricing math instead of adding a third divergent implementation
- [x] T-022: Expose importable loader and selection utilities that `ENG-301` can adopt without reopening pricing assumptions or broadening route/query scope here

## Phase 4: Thin Integration And Tests
- [x] T-030: Add targeted portal-pricing contract tests covering validator rules, date windows, overlap handling, projected-field boundaries, and fail-closed behavior
- [x] T-031: Add a thin integration proof that feeds real listing query fixtures through the shared portal-pricing helper without broad portal-listing query rollout

## Phase 5: Validation And Audit
- [ ] T-900: Run `bunx convex codegen`, `bun check`, `bun typecheck`, targeted Vitest coverage, and `coderabbit review --plain`
- [x] T-910: Run `$linear-pr-spec-audit` against the current branch diff for `ENG-300`
- [ ] T-920: Resolve audit findings or record blockers, reconcile final scope with GitNexus and `git diff`, and close the execution checklist

T-900 note: targeted Vitest coverage and `bun typecheck` passed, but `bunx convex codegen` is blocked by missing `CONVEX_DEPLOYMENT`, `bun check` still fails on unrelated repo-wide diagnostics, and `coderabbit review --plain` refuses to start because the worktree exceeds the service file-count limit.

T-920 note: the implementation scope is reconciled, the audit is recorded, and the remaining open items are the blocked validation gates above.
