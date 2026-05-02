# Execution Checklist: ENG-370 - File Workspace: build files routes, shared file tree, workspace UI, and public link view

## Requirements From Linear
- [x] Add `/files` route tree with authenticated parent layout using `Authenticated` and `AuthLoading` before child routes render suspense queries.
- [x] Use `import { useAuth } from "@workos/authkit-tanstack-react-start/client"` for React auth state when needed.
  - Not needed in this slice; route auth is handled by `guardRouteAccess` and Convex auth wrappers.
- [x] Box index must list participant boxes, show role and last activity, support owned/shared/public-link-enabled/archived filters, and expose create-box action.
- [x] Workspace layout must include left rail box switcher/search/folder tree/trash, top bar breadcrumbs/upload/create-folder/share/view toggle, main pane table/list, and right inspector.
- [x] Shared file tree must support keyboard navigation, expand/collapse, selected path, loading states, drag-target affordances for moves, disabled/trashed states, stable indentation, and touch-friendly behavior.
- [x] File rows must expose icon buttons with tooltips for expected file actions; use lucide icons where available.
- [x] Inspector must show details, comments, versions, activity, access/scan/retention/link state without nested cards.
- [x] Manager settings must manage participants, links, policies, retention, and security activity where backend allows.
- [x] Public/magic-link view must be branded, lightweight, view-only, unauthenticated, and omit platform navigation.
- [x] Public view must hide downloads unless link policy enables downloads and show neutral inaccessible states for expired/revoked links.
- [x] Scan and retention states must be visually explicit: pending scan, blocked/rejected, scan error, released by admin, clean, retention-blocked delete.
- [x] Responsive behavior must be dense but approachable: desktop split-pane, tablet collapsible tree/inspector, and mobile list-first navigation.
  - CSS/layout constraints are implemented and component-tested; live browser responsive validation remains as release-level manual validation.

## Definition Of Done From Linear
- [x] Authenticated and public File Workspace routes are present and tested.
- [x] Shared file tree is reusable and accessible by keyboard.
- [x] UI reflects role/link/scan/retention states accurately.
- [x] Public view is unauthenticated, view-only, and omits platform navigation.
- [x] Layout is responsive without text overlap or nested card shells.
  - Manual browser validation remains noted in audit.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit/React tests added or updated for file tree keyboard behavior, filters, action visibility, inspector tabs, scan/retention/link states, public inaccessible states, and route auth gating.
- [x] E2E tests are not added in this slice because Linear marks E2E journeys out of scope and assigns them to ENG-371.
- [x] Storybook is not required for this slice because the Linear DoD asks for React tests, not stories; reusable components remain test-covered.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] Required quality gates passed: `bunx convex codegen`, `bun check`, `bun typecheck`, targeted tests, and broader `bun run test` if shared route/auth primitives change.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
