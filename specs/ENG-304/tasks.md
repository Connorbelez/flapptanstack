# Tasks: ENG-304 - Broker landing page: add broker customization and theming after v1 launch

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Finalize implementation task list and chunk plan.
- [x] T-002: Run GitNexus impact analysis for planned existing symbol edits and record blast radius.
- [x] T-003: Validate execution artifacts at the `ready-to-edit` stage.

## Phase 2: Contract And Staff Mutation
- [x] T-010: Extend `convex/portals/validators.ts` with constrained landing brand/theme customization validators and public contract fields.
- [x] T-011: Update `convex/portals/queries.ts` to validate and project fallback theme/brand overrides in the shared public landing read model.
- [x] T-012: Add a FairLend-admin mutation path to upsert staff-managed `portalLandingPages.v1LandingContent` customization.
- [x] T-013: Add targeted Convex tests for fallback theme tokens, override projection, unsafe theme values, and staff mutation behavior.

## Phase 3: Renderer And Documentation
- [x] T-020: Update `src/components/portal/landing/PortalLandingPage.tsx` to consume constrained theme/brand tokens through shared renderer styling only.
- [x] T-021: Update route/component tests for theme application and preserved top-level lender vs borrower IA.
- [x] T-022: Update `docs/architecture/broker-landing-page-contract.md` with safe customizable fields and fixed fields.

## Phase 4: Validation And Audit
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted tests for the touched landing scope.
- [x] T-910: Run `$linear-pr-spec-audit`.
- [x] T-920: Resolve audit findings or record blockers.
- [x] T-930: Run final execution-artifact validation.
- [x] T-940: Run `gitnexus_detect_changes` equivalent with local GitNexus CLI and confirm affected scope.
