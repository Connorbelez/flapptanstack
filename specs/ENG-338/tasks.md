# Tasks: ENG-338 - Deal closing: normalize participant, access, and fraction contracts

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Gather Linear issue, comments, plan, and supporting architecture docs.
- [x] T-002: Scaffold execution artifacts under `specs/ENG-338`.
- [x] T-003: Run artifact validation for `ready-to-edit`.
- [x] T-004: Run GitNexus impact analysis for planned edits to `grantDealAccess`, `assertDealAccess`, `canAccessDeal`, `getPortalDealDetail`, `ParticipantSnapshot`, and `PackageSurface`.

## Phase 2: Projection Contract
- [x] T-010: Create `convex/deals/participantProjection.ts` with role/persona/projection types and pure mapping/fraction helpers.
- [x] T-011: Implement server-side projection resolver for buyer, seller, lawyer, active access state, display names, emails, IDs, and unresolved fallback fields.
- [x] T-012: Surface invalid fractional share units outside `0..10000` explicitly in projection output.

## Phase 3: Query And Consumer Wiring
- [x] T-020: Wire `getPortalDealDetail` to return the normalized participant projection while preserving server-side authorization.
- [x] T-021: Update document package read-model code to reuse shared projection semantics where it removes duplicated participant/contact/fraction logic without expanding into envelope orchestration.
- [x] T-022: Update lender deal detail UI to render `fractionalShareDisplayPercent` instead of raw storage units.
- [x] T-023: Update admin deal card UI to render `fractionalShareDisplayPercent` instead of raw storage units.

## Phase 4: Tests
- [x] T-030: Add projection tests for role-to-persona mapping, fraction units/display conversion, invalid fraction surfacing, unresolved buyer/seller fallback, and missing lawyer data.
- [x] T-031: Extend access tests for active scoped access, revoked access denial, platform and guest lawyer access, idempotent grants, role changes, and history preservation.
- [x] T-032: Extend resource-check tests for staff admin versus external admin and normalized deal access outcomes.
- [x] T-033: Update component/query tests for lender/admin fraction display and normalized party labels.

## Phase 5: Validation
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted backend/component tests.
- [x] T-904: Run `bun run test`.
- [x] T-905: Run `bun run review`.
- [x] T-906: Run `gitnexus_detect_changes` or CLI equivalent.
  - Note: local GitNexus CLI has no `detect-changes` command; impact checks, `npx gitnexus analyze --skip-agents-md --no-stats`, and `git diff --stat` were used for scope review instead.

## Phase 9: Audit
- [x] T-910: Run `$linear-pr-spec-audit` against `ENG-338` and the current branch diff.
- [x] T-920: Resolve audit findings or record blockers.
- [x] T-930: Run final execution artifact validation with audit and all tasks/checklist closed.
