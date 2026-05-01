# Chunk Context: chunk-02-nodes

## Goal
- Deliver tree and node lifecycle APIs: list, breadcrumbs, create folder, rename, move, soft delete, restore, and permanent delete when retention allows.

## Relevant plan excerpts
- "Represent each box root as exactly one root folder node."
- "Enforce unique names among non-deleted siblings within the same box and parent."
- "Reject cross-box moves and moves that create cycles or move a folder into itself."
- "Soft-delete folders so descendants are hidden from normal and public/magic-link views without physically deleting every child row."

## Implementation notes
- Use `fileNodes` schema indexes `by_box_parent`, `by_box_parent_name`, and `by_box_deleted`.
- `createBox` already creates one root folder; node operations should discover and guard root rows rather than create extra roots.
- Public/magic-link listings must fail closed and suppress deleted descendants.

## Existing code touchpoints
- `convex/fileWorkspace/boxes.ts`: `createBox` and root folder insertion.
- `convex/fileWorkspace/readModels.ts`: existing box/settings read model shell to extend with tree/public reads.
- New expected module: `convex/fileWorkspace/nodes.ts`.
- GitNexus impact pending after index completes.

## Validation
- Convex tests for create folder, rename, move, delete/restore, trash visibility, public-link hidden deleted descendants, sibling uniqueness, cross-box rejection, and cycle rejection.
