# Tasks: ENG-355 - MIC portal: enforce protected route and host-aware auth boundary

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Gather Linear issue, Notion plan, supporting design context, and repository instructions.
- [x] T-002: Scaffold required execution artifacts with `scripts/init_execution_artifacts.py`.
- [x] T-003: Run GitNexus impact analysis for planned existing-symbol edits and record blast radius.
- [x] T-004: Validate artifacts at the `ready-to-edit` stage.

## Phase 2: Route Policy And Auth Contract
- [x] T-010: Add `/portal` to `src/lib/portal/route-host-policy.ts` before the root catchall.
- [x] T-011: Verify or add `micPortal` route auth rule in `src/lib/auth.ts`.
- [x] T-012: Add policy and route-auth tests for `/portal`, `mic:access`, unrelated permissions, and admin override.

## Phase 3: Protected Route Shell
- [x] T-020: Create `src/routes/portal.tsx` with `beforeLoad: guardRouteAccess("micPortal")`.
- [x] T-021: Gate the protected shell with Convex `Authenticated` and `AuthLoading` before rendering route content.
- [x] T-022: Keep the placeholder shell query-free and active-portal-context-aware.
- [x] T-023: Add route/component coverage proving AuthLoading does not mount protected content and authorized users render the shell.

## Phase 4: Host-Aware MIC Root Sign-In
- [x] T-030: Update `src/routes/index.tsx` so MIC portal unauthenticated sign-in returns to `/portal` on the current MIC host.
- [x] T-031: Preserve non-MIC portal root sign-in behavior where required by existing tests.
- [x] T-032: Add or update root route tests for MIC sign-in CTA return behavior.

## Phase 5: Validation And Audit
- [x] T-900: Run targeted route/auth tests.
- [x] T-901: Run `bunx convex codegen`.
- [x] T-902: Run `bun check`.
- [x] T-903: Run `bun typecheck`.
- [x] T-910: Run `$linear-pr-spec-audit`.
- [x] T-920: Resolve audit findings or record blockers.
- [x] T-930: Run final execution artifact validation.
- [x] T-940: Run `gitnexus_detect_changes` equivalent with `npx gitnexus` before wrap-up.
