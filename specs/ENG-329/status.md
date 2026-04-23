# Execution Status: ENG-329 - Lender portfolio: ship actions-required rail and broker chat surface

- Overall status: complete
- Current phase: complete
- Current chunk: none
- Last updated: 2026-04-23T14:30:09Z

## Active focus
- Complete.

## Blockers
- none

## Notes
- The primary Notion implementation plan, architecture doc, approved UX design spec, and approved HTML mocks have been read and distilled into this spec directory.
- `ENG-311` already owns the route shell and sticky-rail host placement. The current `LenderPortfolioPage` still renders placeholder action and broker blocks inside that host, which is the intended leaf seam for ENG-329.
- The backend contract from `ENG-308` already exposes `actionsRequired`, `brokerCoordination`, fallback contact CTA data, optional `threadId`, and broker prefill payloads through `getLenderPortfolioCommandCenter`.
- GitNexus was reindexed in this `6886` worktree before planning edits. Pre-edit impact analysis for `LenderPortfolioPage` is `LOW` risk with zero tracked upstream callers or affected execution flows.
- `validate_execution_artifacts.py --stage ready-to-edit` passed for `specs/ENG-329/`, so code edits can begin inside the planned chunk boundaries.
- The delivered frontend slice stays leaf-scoped: `Actions Required` and broker coordination now render inside the existing sticky-rail host without taking over route-shell ownership, shared query seams, renewal rules, or messaging-platform scope.
- Broker handoff selection is route-search owned via `brokerContextType` and `brokerSubjectId`, so action and broker-panel prefills stay in sync without introducing local hook state that would bypass the route seam.
- Final validation status for the implemented diff: `bun check`, `bun typecheck`, `bunx convex codegen`, and `bun run test -- src/test/lender/portfolio-rail.test.tsx src/test/routes/lender-portfolio-route.test.tsx` all passed.
