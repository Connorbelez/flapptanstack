# Execution Checklist: ENG-366 - File Workspace: establish schema, contracts, access spine, and audit contracts

## Requirements From Linear
- [x] Add File Workspace schema tables with indexes that support box listing, participant lookup, folder listing, sibling-name uniqueness checks, share-link lookup by token hash, version lookup by node, and activity/security feed queries.
- [x] Model boxes as the top-level permission and policy boundary; do not link boxes, folders, files, comments, or tags to deals, mortgages, CRM records, listings, origination cases, or document-engine rows.
- [x] Define role capabilities for `viewer`, `editor`, and `manager` exactly as the goal specifies.
- [x] Define principal resolution for authenticated WorkOS users, public-link visitors, magic-link visitors, and platform admins.
- [x] Keep link tokens hashed only in storage; raw tokens are returned only at creation time by downstream issues.
- [x] Define immutable version row semantics: file versions are immutable except scan and release state transition fields.
- [x] Define activity and security/audit event envelopes before operation issues write events.
- [x] Include constants for security-sensitive errors that avoid confirming private resource existence.

## Definition Of Done From Linear
- [x] File Workspace tables and validators are present and generated types compile.
- [x] Access and activity/security contracts are documented in code and tests.
- [x] Existing CRM attachment and document-engine upload behavior remains untouched.
- [x] Downstream issues can import typed contracts without inventing schema fields.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added for validators and local type/normalization helpers.
- [x] Unit tests added for viewer/editor/manager/platform-admin/link principal capability matrix.
- [x] Convex schema smoke tests added for File Workspace tables, representative rows, and key indexes.
- [x] E2E tests are not applicable because this slice adds no user/operator workflow.
- [x] Storybook stories are not applicable because this slice adds no UI components.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] `bunx convex codegen` passed.
- [x] `bun check` passed.
- [x] `bun typecheck` passed.
- [x] `bun run test -- convex/fileWorkspace src/test/convex/fileWorkspace src/test/auth` passed, or an equivalent focused command is recorded.
- [x] `bun run test` passed if shared schema/generated type fallout requires broad validation.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
