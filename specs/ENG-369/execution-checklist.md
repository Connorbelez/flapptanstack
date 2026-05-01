# Execution Checklist: ENG-369 - File Workspace: implement file tree, versioning, upload, retention, and secure URLs

## Requirements From Linear
- [ ] Represent every box root as exactly one root folder node.
- [ ] Enforce unique names among non-deleted siblings within the same box and parent.
- [ ] Reject cross-box moves in v1.
- [ ] Reject moves that create cycles or move a folder into itself.
- [ ] Soft-deleting a folder hides descendants from normal views without physically deleting each child row.
- [ ] Deleted content never appears to public or magic-link visitors.
- [ ] Editors and managers can restore from trash when policy allows.
- [ ] Permanent deletion is blocked until retention policy allows it and must write audit evidence before metadata/storage references are removed.
- [ ] Every upload creates version `1`; replacing a file creates version `n + 1`.
- [ ] Previous versions remain available to managers and editors; viewers see only current version in v1.
- [ ] Restoring an old version creates a new current version instead of rewriting history.
- [ ] Version rows are immutable except scan/release transition fields from ENG-367.
- [ ] Preview/download URLs are returned only for `clean` and `released_by_admin` versions and only when role/link policy allows.
- [ ] Public/magic-link read returns permitted listing/preview/download data only and writes access/denial events.
- [ ] Comments are file-scoped only; folder and box comments are out of scope.
- [ ] Tags are box-scoped labels assignable to files and folders.
- [ ] Collaboration activity includes upload, new version, rename, move, comment, tag, delete, restore.
- [ ] Security/manager feed includes participant/link/access/download/preview/scan/retention/denial events from this slice where applicable.

## Definition Of Done From Linear
- [ ] File tree operations enforce hierarchy, role, scan, and retention rules.
- [ ] Versioning is immutable and restore-as-new-current works.
- [ ] Preview/download URLs are never returned for disallowed states.
- [ ] Collaboration and security events are emitted for operations.
- [ ] Public/magic-link read APIs are view-only and fail-closed.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [ ] Unit tests added or updated for helper rules: name normalization/collision, cycle detection, retention eligibility, version allocation, and URL eligibility.
- [ ] Convex tests added or updated for file/folder lifecycle, scan gating, retention, link reads, URL issuance, comments, tags, and event writes.
- [ ] E2E tests are not part of ENG-369; covered by ENG-371.
- [ ] Storybook stories are not applicable because this slice is backend-only and explicitly excludes UI.

## Final Validation
- [ ] All requirements are satisfied.
- [ ] All definition-of-done items are satisfied.
- [ ] `bunx convex codegen` passed.
- [ ] `bun check` passed.
- [ ] `bun typecheck` passed.
- [ ] `bun run test -- convex/fileWorkspace src/test/convex/fileWorkspace` passed.
- [ ] `bun run test` passed.
- [ ] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
