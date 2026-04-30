# Chunk Context: chunk-03-access-events

## Goal
- Define the central access capability contract and event envelopes consumed by downstream File Workspace operations.

## Relevant plan excerpts
- Viewer: list folders/files, preview clean files, view comments/activity, download only when policy allows.
- Editor: viewer capabilities plus upload, create folders, rename, move, tag, comment, create versions, and soft-delete content.
- Manager: editor capabilities plus box settings, participant management, link management, retention settings, scan-release requests, and permanent deletion requests where policy allows.
- Public and magic-link visitors cannot comment, upload, view participant lists, view security/audit events, create links, see trash, inspect old versions, or manage settings.

## Implementation notes
- Consume `Viewer` type only; do not modify `convex/fluent.ts`.
- Platform admin access is derived from `viewer.isFairLendAdmin`/admin permission semantics and does not require participant persistence.
- Activity feed covers collaboration events; security events cover access, sharing, permission, download, preview, scan, retention, and denial events.
- Errors for private resources must fail closed.

## Existing code touchpoints
- New files: `convex/fileWorkspace/access.ts`, `activity.ts`, `securityEvents.ts`.
- Reference only: `convex/fluent.ts` `Viewer`, `convex/authz/policy.ts`, `convex/auditLog.ts`, `convex/auditTrailClient.ts` if needed for event naming.
- Avoid editing `Viewer`, `authMiddleware`, or `requireFairLendAdmin`.

## Validation
- `bun run test -- convex/fileWorkspace`
