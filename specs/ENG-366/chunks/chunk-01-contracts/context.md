# Chunk Context: chunk-01-contracts

## Goal
- Establish importable File Workspace TypeScript contracts and Convex validators before schema/access code depends on them.

## Relevant plan excerpts
- Produced unions: `FileWorkspaceRole = "viewer" | "editor" | "manager"`, `FileWorkspacePrincipalKind = "authenticated" | "public_link" | "magic_link" | "platform_admin"`, `FileBoxStatus = "active" | "archived" | "suspended" | "disabled"`, `FileBoxVisibility = "private" | "public_link" | "magic_link" | "disabled"`, `FileNodeType = "folder" | "file"`, `FileScanState = "pending_scan" | "clean" | "rejected" | "scan_error" | "released_by_admin"`.

## Implementation notes
- Keep contracts standalone under `convex/fileWorkspace/*` with no dependency on generated table types unless needed.
- Include policy validators for downloads, retention, scan policy, storage limits, link policies, normalized names, hashes, and timestamps.
- Validators should be reused by schema and tests; avoid duplicate literal unions.

## Existing code touchpoints
- New files: `convex/fileWorkspace/types.ts`, `convex/fileWorkspace/validators.ts`.
- Existing pattern: domain validators imported by `convex/schema.ts`, such as `convex/crm/validators.ts` and `convex/documents/contracts.ts`.
- GitNexus pending: no existing symbol edit in this chunk unless tests reveal shared helper needs.

## Validation
- `bun run test -- convex/fileWorkspace`
- Later full gates: `bunx convex codegen`, `bun check`, `bun typecheck`
