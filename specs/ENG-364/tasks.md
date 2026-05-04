# Tasks: ENG-364 - Legal representation: add lender and admin lawyer status controls

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Read Linear issue, comments, primary Notion plan, and directly relevant supporting docs.
- [x] T-002: Scaffold required execution artifacts and chunk directories.
- [x] T-003: Run GitNexus indexing and impact checks for existing symbols planned for modification.
- [x] T-004: Validate execution artifacts at `ready-to-edit`.

## Phase 2: Backend Projection And Actions
- [x] T-010: Create `convex/legalRepresentation/status.ts` with a deal-scoped status projection and action availability policy.
- [x] T-011: Extend invitation helpers/mutations for pending resend and change-email semantics without extending expiry.
- [x] T-012: Add lawyer replacement orchestration that revokes old lawyer access, revokes guest invitations, supersedes pending engagement evidence, writes the new selected lawyer, and audits the action.
- [x] T-013: Expose the projection through lender/admin deal queries.

## Phase 3: UI Integration
- [x] T-020: Add lender deal workspace status panel and controls for allowed management actions.
- [x] T-021: Add admin deal operations status panel and controls for the same server projection.
- [x] T-022: Ensure controls are hidden/disabled based on server-projected action availability.

## Phase 4: Tests
- [x] T-030: Add backend projection and management action tests.
- [x] T-031: Add lender/admin route or component tests for visible status labels and controls.
- [x] T-032: Record E2E and Storybook applicability decisions in the checklist/status artifacts.

## Phase 5: Validation
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted backend and route tests.
- [x] T-904: Run `gitnexus_detect_changes` equivalent via GitNexus CLI before finalizing.

## Phase 9: Audit
- [x] T-910: Run `$linear-pr-spec-audit` against ENG-364 and the current branch diff.
- [x] T-920: Resolve audit findings or record blockers.
