# Tasks: ENG-314 - Lender portfolio: ship bottom-of-page suggested opportunities

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Finalize the ENG-314 implementation task list, chunk plan, and execution artifacts from the Linear issue, Notion plan, and current portfolio/listing seams.
- [x] T-002: Run `validate_execution_artifacts.py --stage ready-to-edit` for `specs/ENG-314`.

## Phase 2: Section Components
- [x] T-010: Add `src/components/lender/portfolio/suggested-opportunity-card.tsx` to render server-owned listing metadata, explanation tags, fit rationale, and the listing-detail CTA.
- [x] T-011: Add `src/components/lender/portfolio/suggested-opportunities.tsx` to own section-level loading, empty, unavailable, and stale-data states without re-ranking listings or re-enforcing broker rules.

## Phase 3: Page Integration
- [x] T-020: Replace the ENG-311 placeholder slot content in `src/components/lender/portfolio/LenderPortfolioPage.tsx` with the real suggested-opportunities leaf section while preserving bottom-of-page placement.
- [x] T-021: Extend `src/components/lender/portfolio/fixtures.ts` with suggestion-state fixtures that cover populated, no-results, unavailable, and stale snapshots for tests and stories.

## Phase 4: Tests And Stories
- [x] T-030: Add focused consumer coverage in `src/test/lender/portfolio-suggested-opportunities.test.tsx` for explanation tags, deep links, and empty/unavailable/stale/loading states.
- [x] T-031: Keep the baseline `/lender/portfolio` route test owned by `ENG-311` and shift ENG-314 verification to focused leaf tests instead of route-shell assertions.
- [x] T-032: Add Storybook coverage for the shipped suggested-opportunities section states in `src/components/lender/portfolio/suggested-opportunities.stories.tsx` and update page stories only if additional integration coverage is needed.

## Phase 5: Validation
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run `bun run test -- convex/portfolio/__tests__/queries.test.ts src/test/lender/portfolio-suggested-opportunities.test.tsx src/test/routes/lender-portfolio-route.test.tsx`.
- [x] T-904: Decide whether dedicated Playwright coverage is practical for this bottom-of-page consumer slice and record the outcome in the execution artifacts.
  Result: not practical because the current authenticated browser harness does not seed deterministic lender-portfolio suggestion data and ENG-314 does not own the route/auth seams.

## Phase 9: Audit
- [x] T-910: Run `$linear-pr-spec-audit` against the current branch diff for `ENG-314`.
- [x] T-920: Resolve audit findings or record blockers, then rerun the audit if the verdict is not yet ready.
- [x] T-930: Run final execution-artifact validation plus `gitnexus_detect_changes` and record the closeout evidence.
  Result: `gitnexus_detect_changes` reported `medium` risk limited to `LenderPortfolioPage` and three local portfolio helper processes; no unexpected modules or flows were surfaced.
