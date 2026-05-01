# Summary: ENG-369 - File Workspace: implement file tree, versioning, upload, retention, and secure URLs

- Source issue: https://linear.app/fairlend/issue/ENG-369/file-workspace-implement-file-tree-versioning-upload-retention-and
- Primary plan: https://www.notion.so/350fc1b44024811baf2ce27c1eca7a00
- Supporting docs:
  - https://www.notion.so/350fc1b4402480efa2f0c395b89fa1d6
  - ENG-366 schema/access contracts
  - ENG-367 scanner/policy helpers
  - ENG-368 box/participant/link access resolver

## Scope
- Implement backend File Workspace operations for folder/file listing, breadcrumbs, folder creation, upload request/finalize, replacement versions, restore-as-new-current, rename, move, soft delete, restore, permanent delete when retention permits, secure preview/download URLs, comments, tags, activity writes, and security events.
- Add Convex and unit tests for lifecycle, scan gating, retention, link read behavior, and destructive-operation consistency.
- Out of scope: UI, E2E browser journeys, external preview renderer, paid scanners, folder-level comments, box-level comments, custom roles, per-file ACLs, and cross-box moves.

## Constraints
- Use `fileWorkspaceAccess` / `assertFileWorkspaceCapability`; do not add local role checks that bypass the access spine.
- Never return storage URLs for pending, rejected, scan-error, deleted, expired-link, or download-disabled contexts.
- Do not rewrite old version rows; restoring an old version creates a new current version.
- Permanent deletion must write immutable audit/security evidence before metadata/storage references are removed.
- Soft-deleted folders hide descendants from normal and public/magic-link views without patching every descendant row.
- Exported Convex functions must use fluent-convex and end with explicit `.public()` or `.internal()`.

## Open questions
- None blocking. ENG-367 keeps archives disabled by default until safe inspection exists.
