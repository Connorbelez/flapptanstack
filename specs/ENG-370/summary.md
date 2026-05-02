# Summary: ENG-370 - File Workspace: build files routes, shared file tree, workspace UI, and public link view

- Source issue: https://linear.app/fairlend/issue/ENG-370/file-workspace-build-files-routes-shared-file-tree-workspace-ui-and
- Primary plan: https://www.notion.so/350fc1b440248117b88bf31a49ca079a
- Supporting docs:
  - https://www.notion.so/350fc1b4402480efa2f0c395b89fa1d6

## Scope
- Build the authenticated `/files` route tree, including a parent route that gates child suspense queries with `Authenticated` and `AuthLoading`.
- Build the `/files` box index with role, status, last activity, filters, and create-box affordance backed by the existing file workspace Convex APIs.
- Build the `/files/$boxId` workspace shell with left tree rail, top actions, table/list main pane, inspector, manager settings, upload/create-folder/share controls, and responsive behavior.
- Build reusable `src/components/file-workspace/*` components, especially a keyboard-accessible `FileTree`.
- Build the unauthenticated `/files/public/$token` view-only surface for public and magic links.
- Add focused React/route tests for route auth gating, file tree behavior, role/policy action visibility, public view states, and scan/retention state rendering.

## Constraints
- This slice is UI-only; do not change backend behavior unless a compile-blocking contract mismatch is discovered and tracked first.
- Authenticated suspense query screens must render below a parent `Authenticated` / `AuthLoading` wrapper.
- Use `useAuth` from `@workos/authkit-tanstack-react-start/client` when React auth state is needed.
- Public/magic-link visitors must not see authenticated platform navigation, manager/security/participant/trash/old-version UI, or mutation affordances.
- UI hides or disables actions from backend capability/read-model flags; it must not invent authorization.
- No nested cards or floating card shell sections for the workspace surface.
- Use ShadCN primitives, lucide icons, tooltips, stable row heights, stable indentation, and existing FairLend palette/typography.
- Desktop uses split panes; tablet can collapse tree/inspector; mobile is list-first with no text overlap.

## Open questions
- none
