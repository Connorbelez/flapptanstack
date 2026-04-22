# Chunk Context: chunk-03-tests-validation-audit

## Goal
- Update fixtures, Storybook coverage, focused component tests, validation evidence, and the final spec audit so ENG-313 closes with proof rather than only UI changes.

## Relevant plan excerpts
- "Add focused component coverage for cockpit and CSV-export strip rendering."
- "Cover disabled export, empty chart states, and current-vs-complete period labeling."
- "Focused cockpit and export tests plus repo validation commands pass."
- "Before finalizing, invoke `$linear-pr-spec-audit` against the same issue and the current PR or branch diff, then persist the verdict in `specs/<issue-key>/audit.md`."

## Implementation notes
- Prefer focused RTL coverage in a new `src/test/lender/portfolio-cockpit.test.tsx` rather than growing the route-host test with leaf-specific assertions.
- Update Storybook fixture states so visual review covers disabled export and no-history cases.
- Reuse the existing upstream backend export tests as supporting evidence but keep leaf behavior covered by frontend tests.
- Evaluate Playwright feasibility explicitly; if the current auth/portal harness cannot seed deterministic lender portfolio data, record that justification rather than inventing flaky E2E coverage.

## Existing code touchpoints
- `src/components/lender/portfolio/fixtures.ts`
- `src/components/lender/portfolio/LenderPortfolioPage.stories.tsx`
- `src/test/routes/lender-portfolio-route.test.tsx`
- `src/test/lender/portfolio-cockpit.test.tsx` (new)
- `convex/portfolio/__tests__/export.test.ts`

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- `bun run test -- src/test/lender/portfolio-cockpit.test.tsx convex/portfolio/__tests__/export.test.ts`
- `python3 /Users/connor/.codex/skills/linear-implement-v2/scripts/validate_execution_artifacts.py ENG-313 --repo-root "/Users/connor/.codex/worktrees/2c44/fairlendapp" --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`
