# Summary: ENG-368 - File Workspace: implement boxes, participants, and bearer link backend

- Source issue: https://linear.app/fairlend/issue/ENG-368/file-workspace-implement-boxes-participants-and-bearer-link-backend
- Primary plan: https://www.notion.so/350fc1b4402481e5a6fdc33883e2988f
- Supporting docs:
  - https://www.notion.so/350fc1b4402480efa2f0c395b89fa1d6
  - ENG-366 local contracts in convex/fileWorkspace/*

## Scope
- Implement authenticated box create/list/update/archive functions.
- Create one root folder node, creator manager participant, collaboration activity, and security event during box creation.
- Implement participant list/upsert/remove with normalized auth/email grants, role updates, duplicate-grant handling, and last-manager protection.
- Implement public and magic bearer link create/list/revoke/resolve behavior with hashed token storage and one-time raw token return on creation.
- Extend the File Workspace access layer with box-aware principal resolution and capability assertion helpers for ENG-369 consumers.
- Add manager settings and box index read models for ENG-370 consumers.
- Add focused Convex/unit tests for box, participant, link, access matrix, and fail-closed denial behavior.

## Constraints
- WorkOS AuthKit remains the canonical authenticated user source; public and magic link visitors have no WorkOS identity.
- `admin:access` grants platform oversight but must not add admins as participants.
- Link lookup accepts raw bearer token input, hashes it server-side, and compares only against `fileShareLinks.tokenHash`.
- Raw link tokens are returned only from create operations and never from list/read operations.
- Public and magic link visitors are view-only by default and cannot access participants, security feed, trash, old versions, comments write, uploads, link management, or settings.
- Disabled and suspended boxes fail closed for normal participants and bearer visitors.
- Security-sensitive errors must use neutral messages such as `Box not found or access denied.`
- Exported Convex functions must use fluent-convex and explicit `.public()` or `.internal()`.
- Do not implement upload scanning, node move/delete/restore/versioning, UI, email delivery, email-bound magic links, or per-file/folder ACLs in this issue.

## Open questions
- None blocking. Linear still marks ENG-366 as In Review, but this worktree contains the ENG-366/ENG-367 File Workspace contracts required for local implementation.
