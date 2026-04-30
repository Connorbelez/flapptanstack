# Tasks: ENG-366 - File Workspace: establish schema, contracts, access spine, and audit contracts

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Gather Linear issue, comments, Notion implementation plan, and goal design context.
- [x] T-002: Scaffold execution artifacts and chunk directories.
- [x] T-003: Run GitNexus indexing and impact analysis for planned existing-symbol edits.

## Phase 2: Contracts
- [x] T-010: Create `convex/fileWorkspace/types.ts` with role, principal, status, visibility, node, scan, policy, DTO, and immutable version contracts.
- [x] T-011: Create `convex/fileWorkspace/validators.ts` with exported Convex validators for all File Workspace unions, policies, principals, nodes, versions, links, comments, tags, activity, and security envelopes.
- [x] T-012: Add validator/normalization unit tests for roles, principal kinds, states, policies, safe file names, hashes, and retention/download policy shapes.

## Phase 3: Schema
- [x] T-020: Add File Workspace tables and required indexes to `convex/schema.ts`.
- [x] T-021: Add schema smoke tests that insert representative boxes, participants, nodes, versions, links, comments, tags, activity events, and security events.
- [x] T-022: Verify the schema does not introduce foreign keys to deal, mortgage, CRM, listing, origination, or document-engine tables.

## Phase 4: Access And Events
- [x] T-030: Create `convex/fileWorkspace/access.ts` with principal resolution contracts, access result shapes, role capability matrix, platform-admin behavior, and fail-closed helpers.
- [x] T-031: Create `convex/fileWorkspace/activity.ts` with collaboration event envelope helpers.
- [x] T-032: Create `convex/fileWorkspace/securityEvents.ts` with security/audit event envelope helpers and security-sensitive error constants.
- [x] T-033: Add unit tests for authenticated, platform-admin, public-link, and magic-link capability behavior.

## Phase 5: Fixtures
- [x] T-040: Create `convex/fileWorkspace/testUtils.ts` with seed helpers for admin, broker manager, editor, viewer, non-participant, link principals, and representative boxes.
- [x] T-041: Add fixture tests proving seeded rows satisfy schema contracts and access helpers consume them.

## Phase 6: Validation
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run focused File Workspace/auth tests.
- [x] T-904: Run broader `bun run test` if generated/schema fallout affects shared surfaces.
- [x] T-905: Run final execution artifact validation.

## Phase 9: Audit
- [x] T-910: Run `$linear-pr-spec-audit` against ENG-366 and the current branch diff.
- [x] T-920: Resolve audit findings or record blockers, then persist the verdict in `specs/ENG-366/audit.md`.
