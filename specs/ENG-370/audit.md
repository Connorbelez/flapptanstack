# Spec Audit: ENG-370 - File Workspace: build files routes, shared file tree, workspace UI, and public link view

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff in `/Users/connor/.codex/worktrees/9344/fairlendapp`
- Last run: 2026-05-01T16:49:17Z
- Verdict: needs manual validation

## Findings
- [manual-validation] The implementation satisfies the route, component, auth, public-link, state-rendering, and automated test requirements, but responsive behavior still needs a live browser pass with seeded authenticated file-workspace data. The branch includes responsive layout constraints and React coverage, but no Playwright/browser screenshot artifact for desktop/tablet/mobile authenticated flows.

## Coverage Summary
- SATISFIED: 17
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 1
- OUT_OF_SCOPE: 2

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
| --- | --- | --- | --- | --- |
| SATISFIED | routes/auth | `/files` route tree uses an authenticated parent layout with `Authenticated` and `AuthLoading` before suspense query children. | `src/routes/files/route.tsx:6`, `src/routes/files/route.tsx:11`; `src/test/routes/file-workspace-route.test.tsx` | Matches canonical listings pattern. |
| SATISFIED | routes/auth | Files route access is limited to admin/broker policy. | `src/lib/auth.ts`; `src/test/routes/file-workspace-route.test.tsx` | Adds `files` route authorization rule and tests admin, broker, viewer cases. |
| SATISFIED | route host policy | Authenticated `/files` is portal-scoped; `/files/public/*` is shared/public-host scoped. | `src/lib/portal/route-host-policy.ts`; `src/test/routes/route-host-policy.test.ts` | Prevents public links from requiring portal host policy. |
| SATISFIED | box index | `/files` lists participant boxes with role, status, visibility, last activity, filters, and create-box action backed by Convex. | `src/routes/files/index.tsx:38`; `src/components/file-workspace/BoxIndexPage.tsx:63`; `src/test/file-workspace/authenticated-workspace.test.tsx:164` | Filters are URL-driven; create box uses `api.fileWorkspace.boxes.createBox`. |
| SATISFIED | workspace route | `/files/$boxId` loads box, capabilities, nodes, manager settings, comments, tags, and versions from existing read models. | `src/routes/files/$boxId.tsx:23`, `src/routes/files/$boxId.tsx:56`, `src/routes/files/$boxId.tsx:88` | Optional read models are gated by capability flags. |
| SATISFIED | workspace actions | Upload, create folder, share link, preview, download, restore, folder navigation, and view-mode controls are wired to existing Convex APIs/capabilities. | `src/routes/files/$boxId.tsx:141`, `src/routes/files/$boxId.tsx:150`, `src/routes/files/$boxId.tsx:191`; `src/components/file-workspace/UploadControls.tsx` | UI does not invent auth; disabled/visible states derive from capabilities. |
| SATISFIED | workspace layout | Workspace includes left rail search/tree/trash, top breadcrumbs/actions/view toggle, main file table/list rows, and right inspector. | `src/components/file-workspace/WorkspacePage.tsx:146` | Uses split-pane grid and avoids nested card shells. |
| SATISFIED | reusable tree | Shared `FileTree` supports expand/collapse, selected state, loading, drag target, disabled, trashed, stable indentation, and touch-sized controls. | `src/components/file-workspace/FileTree.tsx:14`; `src/test/file-workspace/file-tree.test.tsx:47` | Branch-scoped Biome/a11y check passes. |
| SATISFIED | keyboard accessibility | Tree supports ArrowUp/ArrowDown focus movement, ArrowRight expand, ArrowLeft collapse/parent focus, and Enter/Space selection. | `src/components/file-workspace/FileTree.tsx:103`; `src/test/file-workspace/file-tree.test.tsx:88` | Disabled nodes do not select. |
| SATISFIED | inspector | Inspector shows details, comments, versions, tags, activity, access/scan, retention, and link state without nested cards. | `src/components/file-workspace/FileInspector.tsx`; `src/test/file-workspace/authenticated-workspace.test.tsx:182` | Comments/tags/versions are route-fed when capability allows. |
| SATISFIED | manager settings | Manager settings show participants, links, policies, retention, and link creation where backend allows. | `src/components/file-workspace/ShareSettings.tsx`; `src/routes/files/$boxId.tsx:88` | Rendered only when `manage_box_settings` query succeeds. |
| SATISFIED | public route | `/files/public/$token` is unauthenticated, resolves bearer links, lists bearer nodes, opens folders, and requests bearer preview/download URLs. | `src/routes/files/public/$token.tsx:11`, `src/routes/files/public/$token.tsx:31`, `src/routes/files/public/$token.tsx:75` | Uses mutation calls because backend writes link/security access state. |
| SATISFIED | public navigation | Public file share omits the platform header/navigation. | `src/routes/__root.tsx`; `src/test/routes/file-workspace-route.test.tsx` | Header hidden for `/files/public/*`. |
| SATISFIED | public policy | Public view is branded, lightweight, view-only, hides downloads unless enabled, and renders neutral inaccessible states. | `src/components/file-workspace/PublicFileViewPage.tsx:47`; `src/test/file-workspace/public-file-view.test.tsx:67` | Scan-blocked downloads are disabled. |
| SATISFIED | backend contract | Public route receives root folder id from `resolveBearerLink` without exposing raw backend internals. | `convex/fileWorkspace/shareLinks.ts` | Additive return field only; existing auth/link validation preserved. |
| SATISFIED | tests | Focused React/route tests cover auth gating, filters/actions, inspector/manager states, file tree keyboard behavior, public inaccessible/download/scan states. | `src/test/file-workspace/*`; `src/test/routes/file-workspace-route.test.tsx` | Full repo tests pass. |
| SATISFIED | validation | Required gates were run: `bunx convex codegen`, `bun check`, `bun typecheck`, targeted tests, route tests, and full `bun run test`. | `specs/ENG-370/status.md`; `specs/ENG-370/chunks/chunk-05-validation-audit/status.md` | `bun check` exits 0 with existing unrelated complexity warnings. |
| UNVERIFIED | responsive/manual | Desktop/tablet/mobile no-overlap behavior should be checked in a real browser with seeded authenticated data. | CSS/layout evidence in `WorkspacePage`, `PublicFileViewPage`; no screenshot artifact | Manual validation remains. |
| OUT_OF_SCOPE | e2e | Add Playwright E2E journeys. | Linear scope note in execution checklist | Assigned to ENG-371. |
| OUT_OF_SCOPE | stories | Add Storybook stories. | Linear DoD asks for React tests, not stories | Components remain test-covered. |

## Unresolved items
- Manual browser validation for responsive authenticated workspace layout with seeded file-workspace data.

## Next action
- Run the ENG-371 E2E/browser slice or a manual seeded browser pass before release-level signoff.
