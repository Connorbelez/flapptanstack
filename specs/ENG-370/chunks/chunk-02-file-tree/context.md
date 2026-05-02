# Chunk Context: chunk-02-file-tree

## Goal
- Build the reusable controlled file tree that the authenticated workspace and public view can share.

## Relevant plan excerpts
- "Add a shared file tree component."
- "It should support keyboard navigation, expand/collapse, selected path, loading states, drag target affordances for moves, and disabled/trashed states."
- "Styling should use the existing FairLend typography/palette and ShadCN primitives."

## Implementation notes
- Component should accept flattened/tree node data from read models instead of fetching directly.
- Keyboard coverage: ArrowDown/ArrowUp moves visible focus, ArrowRight expands folders, ArrowLeft collapses or moves to parent, Enter selects.
- Stable indentation and row dimensions are required so hover/selection/loading states do not shift layout.
- Use lucide folder/file/status icons and tooltips where action meaning is not textual.

## Existing code touchpoints
- New file: `src/components/file-workspace/FileTree.tsx`.
- New tests: `src/test/file-workspace/file-tree.test.tsx`.
- Existing primitives: `src/components/ui/button.tsx`, `tooltip.tsx`, `skeleton.tsx`, `badge.tsx`.

## Validation
- `bun run test -- src/test/file-workspace/file-tree.test.tsx`
- `bun typecheck`
