# Chunk Context: chunk-03-authenticated-workspace

## Goal
- Build the authenticated box index, workspace shell, inspector, settings, and upload/share controls around backend read models and capability flags.

## Relevant plan excerpts
- "Box index must list participant boxes, show role and last activity, support owned/shared/public-link-enabled/archived filters, and expose create-box action."
- "Workspace layout must include left rail box switcher/search/folder tree/trash, top bar breadcrumbs/upload/create-folder/share/view toggle, main pane table/list, and right inspector."
- "Inspector must show details, comments, versions, activity, access/scan/retention/link state without nested cards."
- "Manager settings must manage participants, links, policies, retention, and security activity where backend allows."

## Implementation notes
- Keep the workspace as a dense operational surface, not a landing page.
- Actions must derive visibility/disabled state from capabilities, role, link policy, scan state, and retention state.
- Public-only restrictions are not enforced here; authenticated UI can expose manager-only panels only when capabilities allow.
- Avoid nested cards; use bands, borders, split panels, table/list rows, tabs, sheets/drawers, and inspector sections.

## Existing code touchpoints
- New files: `BoxIndexPage.tsx`, `WorkspacePage.tsx`, `FileInspector.tsx`, `ShareSettings.tsx`, `UploadControls.tsx`.
- Existing UI primitives: button, badge, tabs, sheet, drawer, dropdown-menu, table, input, tooltip, resizable, skeleton.
- Backend APIs: box/create/read, nodes/list/create/move/delete/restore, uploads, share links, manager settings, comments, tags, versions.

## Validation
- `bun run test -- src/test/file-workspace`
- `bun typecheck`
