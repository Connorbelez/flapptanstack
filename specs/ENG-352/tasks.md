# Tasks: ENG-352 - MIC portal: establish portal, RBAC, and MIC lender mapping contract

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Finalize implementation task list and chunk plan from Linear ENG-352 and linked Notion docs.
- [x] T-002: Run GitNexus impact analysis for expected modified symbols before implementation edits.

## Phase 2: Portal Contract
- [x] T-010: Add `mic` to portal type validation and TypeScript contracts.
- [x] T-011: Add `micLenderAuthId` support to portal schema/config contract.
- [x] T-012: Ensure MIC portal host data uses existing `buildPortalHosts` and registry lookup paths.
- [x] T-013: Add or update seed/admin configuration helpers for a local MIC portal contract.

## Phase 3: RBAC Contract
- [x] T-020: Add `mic:access` permission metadata to the canonical catalog.
- [x] T-021: Add `micinvestor` role with only `mic:access`.
- [x] T-022: Update WorkOS permission seeding script and permission snapshot/parity tests.
- [x] T-023: Add MIC route authorization key requiring `mic:access` with `admin:access` wildcard compatibility.

## Phase 4: MIC Lender Mapping And Tests
- [x] T-030: Add fail-closed MIC portal config resolver for `portalId`, `orgId`, and `micLenderAuthId`.
- [x] T-031: Add Convex tests for active MIC portal resolution by slug, production host, and local host.
- [x] T-032: Add tests for missing or invalid `micLenderAuthId` failing closed without org ownership fallback.
- [x] T-033: Add regression tests proving existing FairLend and broker portal host resolution still passes.
- [x] T-034: Add route/auth tests for MIC permission acceptance, unrelated permission rejection, and admin wildcard behavior.

## Phase 5: Validation
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted auth, portal, and route tests.
- [x] T-904: Run final execution artifact validation.

## Phase 9: Audit
- [x] T-910: Run `$linear-pr-spec-audit` against ENG-352 and the current branch diff.
- [x] T-920: Resolve audit findings or record explicit blockers.
