# Chunk Context: chunk-04-access-read-models

## Goal
- Deliver central access resolver, capability assertion, and UI/file-operation read models.

## Relevant plan excerpts
- `resolveFileWorkspacePrincipal` must handle authenticated, platform-admin, public-link, and magic-link principals.
- `assertFileWorkspaceCapability` is the only permission decision point for ENG-369 operations.
- UI routes in ENG-370 should consume read models instead of reconstructing role/link logic.
- Security-sensitive errors must not reveal private box/link existence.

## Implementation notes
- Authenticated participant resolution should check active participant grants by auth id first and verified/lowercase email as fallback.
- Platform admin oversight should resolve without participant row creation.
- Normal participants and bearer links should fail closed for suspended/disabled boxes.
- Public/magic read models must not expose participants, security events, settings, trash, old versions, uploads, or comment-write affordances.

## Existing code touchpoints
- Existing file to modify: `convex/fileWorkspace/access.ts`.
- New file: `convex/fileWorkspace/readModels.ts`.
- Potential consumers from later issues: ENG-369 file operations and ENG-370 UI routes.
- GitNexus blast radius for existing access helpers is LOW.

## Validation
- Access/read model matrix tests in `convex/fileWorkspace/__tests__`.
- Later full gates: `bunx convex codegen`, `bun check`, `bun typecheck`.
