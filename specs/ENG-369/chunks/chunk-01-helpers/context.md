# Chunk Context: chunk-01-helpers

## Goal
- Validate artifacts and implement shared helper surfaces for the rest of ENG-369.

## Relevant plan excerpts
- "Implement pure helpers for name normalization, sibling collision, cycle detection, retention eligibility, version allocation, and URL eligibility with unit tests."
- "Do not bypass `fileWorkspaceAccess` with local role checks."
- "Do not return storage URLs for unscanned, rejected, deleted, expired-link, or download-disabled contexts."

## Implementation notes
- Existing foundations: `convex/fileWorkspace/validators.ts` already normalizes names and sibling keys; `access.ts` resolves authenticated and bearer principals; `operations.ts` centralizes defaults, box principal helpers, and event insert helpers.
- Add new helpers in focused modules, likely `retention.ts` and a node/version helper module, rather than expanding unrelated CRM/document-engine storage flows.

## Existing code touchpoints
- `convex/fileWorkspace/validators.ts`: `normalizeFileWorkspaceName`, `normalizeFileWorkspaceSiblingKey`.
- `convex/fileWorkspace/access.ts`: `resolveFileWorkspacePrincipal`, `assertFileWorkspaceCapability`, `capabilitiesForPrincipal`.
- `convex/fileWorkspace/operations.ts`: defaults and event insertion helpers.
- GitNexus impact pending after index completes.

## Validation
- `bun run test -- convex/fileWorkspace`
- Later full gates in chunk 05.
