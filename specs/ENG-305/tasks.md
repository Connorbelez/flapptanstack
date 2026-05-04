# Tasks: ENG-305 - Broker landing page: render the fixed-template production portal root

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Gather Linear issue, Notion implementation plan, UI spec, and prerequisite ENG-303/ENG-301 context.
- [x] T-002: Scaffold and populate execution artifacts and chunk plan.
- [x] T-003: Run ready-to-edit artifact validation and GitNexus impact analysis for planned existing-symbol edits.

## Phase 2: Root Contract Consumption
- [x] T-010: Update `src/routes/index.tsx` to query `getPublicPortalLandingPage` for portal root instead of the older public teaser query.
- [x] T-011: Keep non-portal marketing/admin root fallback behavior intact.
- [x] T-012: Update `src/routes/__root.tsx` so generic shared `Header` is suppressed on public portal root while preserving non-root portal and admin behavior.

## Phase 3: Landing Presentation
- [x] T-020: Add `src/components/portal/landing/PortalLandingPage.tsx` to compose the fixed landing IA from the landing contract.
- [x] T-021: Add focused landing section/card helpers for navigation, hero, trust strip, switchboard, teaser cards, and financing strip.
- [x] T-022: Ensure responsive desktop/mobile hierarchy, at most three visible listing cards, and blurred continuation semantics match the contract.

## Phase 4: Tests And Validation
- [x] T-030: Update portal-home route tests to mock the landing contract query and assert IA order, CTA labels, and no diagnostic chrome.
- [x] T-031: Add or update coverage for teaser-disabled/empty states and root header suppression.
- [x] T-900: Run `bun check`, `bun typecheck`, and `bunx convex codegen`.
- [x] T-901: Run targeted route/component tests for the portal landing page.

## Phase 9: Audit
- [x] T-910: Run `$linear-pr-spec-audit` for ENG-305 against the current branch diff and persist the result to `audit.md`.
- [x] T-920: Resolve audit findings or record blockers, then rerun artifact final validation.
