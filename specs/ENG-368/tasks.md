# Tasks: ENG-368 - File Workspace: implement boxes, participants, and bearer link backend

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Gather Linear issue, comments, Notion plan, goal page, and local ENG-366/ENG-367 contract context.
- [x] T-002: Scaffold and populate execution artifacts and chunk plan.
- [x] T-003: Run GitNexus indexing and impact checks for existing File Workspace helpers expected to change.

## Phase 2: Boxes
- [x] T-010: Add shared File Workspace operation helpers for time, actor extraction, participant keys, and default policies.
- [x] T-011: Implement `convex/fileWorkspace/boxes.ts` box create/list/get/update/archive fluent functions.
- [x] T-012: Ensure box creation inserts root folder, creator manager participant, activity event, and security event.

## Phase 3: Participants
- [x] T-020: Implement participant grant normalization for auth-id and email grants.
- [x] T-021: Implement `convex/fileWorkspace/participants.ts` list/upsert/remove fluent functions with role validation.
- [x] T-022: Enforce duplicate upsert behavior, manager/platform authority, event emission, and last-manager removal protection.

## Phase 4: Share Links
- [x] T-030: Add token generation and hashing utilities with injectable entropy for tests.
- [x] T-031: Implement `convex/fileWorkspace/shareLinks.ts` create/list/revoke fluent functions.
- [x] T-032: Implement bearer link resolution with expiry, revocation, visibility, disabled/suspended box checks, and no raw token leakage outside creation.

## Phase 5: Access And Read Models
- [x] T-040: Extend `convex/fileWorkspace/access.ts` with `resolveFileWorkspacePrincipal` and `assertFileWorkspaceCapability` for authenticated, platform admin, public-link, and magic-link principals.
- [x] T-041: Implement read models for box index and manager settings in `convex/fileWorkspace/readModels.ts`.
- [x] T-042: Ensure access denials and link opens write security events where required without leaking existence.

## Phase 6: Tests
- [x] T-050: Add box operation tests for creation side effects, admin/broker allow, non-creator deny, listing, update, archive, and oversight without participant persistence.
- [x] T-051: Add participant operation tests for invite/upsert, duplicate email/user grants, role changes, removal, event emission, and last-manager protection.
- [x] T-052: Add share link tests for token one-time return, hashed storage, list redaction, revoke/expiry/tamper/disabled behavior, and download policy.
- [x] T-053: Add access/read-model tests for viewer/editor/manager/platform-admin/public/magic capability matrix and fail-closed behavior.
- [x] T-054: Record why ENG-368 does not add E2E or Storybook coverage.

## Phase 7: Validation And Audit
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run `bun run test -- convex/fileWorkspace src/test/convex/fileWorkspace src/test/auth`.
- [x] T-904: Run broader `bun run test` if shared auth/policy code changed.
- [x] T-910: Run `$linear-pr-spec-audit`.
- [x] T-920: Resolve audit findings or record blockers.
- [x] T-930: Run final execution artifact validation.
- [x] T-940: Run GitNexus change detection before closeout.
