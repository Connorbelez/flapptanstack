# Chunk Context: chunk-02-workspace-e2e

## Goal
- Cover authenticated File Workspace browser journeys for creation, navigation, upload, scan states, preview/download, replacement, and responsive behavior.

## Relevant plan excerpts
- `e2e/file-workspace/workspace.spec.ts`: box creation, folder navigation, upload quarantine, clean preview/download, version replacement.
- Edge cases: long filenames, deep tree, mobile/tablet viewports.

## Implementation notes
- Prefer visible labels, role selectors, and backend helper state over time-based waits.
- Upload flow should prove `pending_scan` blocks preview/download and clean or released versions expose the correct controls.
- Replacement flow should assert previous current stays visible until the new version is clean.

## Existing code touchpoints
- `src/routes/files/index.tsx` create-box route.
- `src/routes/files/$boxId.tsx` upload, folder, share, preview, download route wiring.
- `src/components/file-workspace/WorkspacePage.tsx`, `FileTree.tsx`, `UploadControls.tsx`, and `FileInspector.tsx`.

## Validation
- `bun run test:e2e -- e2e/file-workspace/workspace.spec.ts`
- `bun run test -- src/test/file-workspace src/test/routes`
