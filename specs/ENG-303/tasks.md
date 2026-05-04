# Tasks: ENG-303 - Broker landing page: define the v1 production portal template contract

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Gather Linear issue, Notion implementation plan, approved UI/UX spec, and repo instructions.
- [x] T-002: Scaffold execution artifacts and define chunk plan.
- [x] T-003: Run GitNexus index and impact analysis before editing existing symbols.

## Phase 2: Schema And Contract
- [x] T-010: Extend `portalLandingPages` with minimal optional v1 landing copy fields.
- [x] T-011: Add validators and TypeScript contract types for structural fields, optional presentation copy, CTA paths, trust-strip items, featured teaser metadata, and financing-strip labels.
- [x] T-012: Document fallback policy and structural-vs-presentation ownership in code-adjacent docs.

## Phase 3: Public Landing Query
- [x] T-020: Add one public landing-page query/read-model builder in the portal layer that accepts a resolved `portalId`.
- [x] T-021: Compose portal identity, live broker identity/licensing, optional landing copy, deterministic fallbacks, and nested pre-approval actions.
- [x] T-022: Compose featured listing teaser data through the live portal-aware listing projection with portal pricing.

## Phase 4: Frontend Contract
- [x] T-030: Add `src/components/portal/landing/landing-types.ts` with frontend-facing contract types derived from the Convex API shape.
- [x] T-031: Export the landing contract type from the portal landing module for ENG-305 consumption.

## Phase 5: Tests
- [x] T-040: Add targeted Convex tests for fallback contract shaping on FairLend and broker portals.
- [x] T-041: Add targeted Convex tests for optional landing-copy overrides, live broker licensing, nested pre-approval, disabled teaser behavior, and portal-priced teaser listings.

## Phase 6: Validation
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted unit tests for portal landing contract behavior.
- [x] T-904: Record why e2e and Storybook are inapplicable, or add them if implementation scope changes.

## Phase 9: Audit
- [x] T-910: Run `$linear-pr-spec-audit` for ENG-303 against the current branch diff.
- [x] T-920: Resolve audit findings or record blockers and rerun audit if needed.
- [x] T-930: Run final execution artifact validation.
