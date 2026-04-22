# Spec Compliance Review

- Audit skill: `$linear-pr-spec-audit`
- Review target: local `ENG-313` worktree diff on top of `eng-311-lender-portfolio` (no PR opened yet)
- Last run: 2026-04-22T21:40:08Z
- Verdict: ready

## Findings
- No remaining spec-compliance findings. The branch now satisfies the missing projection surface and the required validation gates.

## Verdict
- ready

## Coverage Summary
- SATISFIED: 12
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 0

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
| --- | --- | --- | --- | --- |
| SATISFIED | capability | Render the financial cockpit at the top of `/lender/portfolio` | [LenderPortfolioPage.tsx](/Users/connor/.codex/worktrees/2c44/fairlendapp/src/components/lender/portfolio/LenderPortfolioPage.tsx:85), [portfolio-shell.tsx](/Users/connor/.codex/worktrees/2c44/fairlendapp/src/components/lender/portfolio/portfolio-shell.tsx:45) | The cockpit placeholder is replaced in-place without creating a new route. |
| SATISFIED | capability | Show KPI cards for YTD, monthly, lifetime, and risk/renewal summary | [portfolio-cockpit.tsx](/Users/connor/.codex/worktrees/2c44/fairlendapp/src/components/lender/portfolio/portfolio-cockpit.tsx:100) | Four primary cards render from the upstream cockpit metrics. |
| SATISFIED | capability | Render profit/projection charts from upstream contracts | [portfolio-cockpit.tsx](/Users/connor/.codex/worktrees/2c44/fairlendapp/src/components/lender/portfolio/portfolio-cockpit.tsx:148), [contracts.ts](/Users/connor/.codex/worktrees/2c44/fairlendapp/convex/portfolio/contracts.ts:29), [snapshots.ts](/Users/connor/.codex/worktrees/2c44/fairlendapp/convex/portfolio/snapshots.ts:515) | The cockpit now charts `projectedAggregateEarnings`, and the upstream snapshot/history seam computes that field from snapshot-backed remaining-interest projections through maturity. |
| SATISFIED | capability | Render portfolio breakdown visuals from upstream contracts | [portfolio-cockpit.tsx](/Users/connor/.codex/worktrees/2c44/fairlendapp/src/components/lender/portfolio/portfolio-cockpit.tsx:175) | Mortgage-status and property-type pies are rendered from the command-center breakdown contract. |
| SATISFIED | resilience | Keep loading, empty, and error chart states layout-safe | [portfolio-cockpit.tsx](/Users/connor/.codex/worktrees/2c44/fairlendapp/src/components/lender/portfolio/portfolio-cockpit.tsx:232), [portfolio-cockpit.test.tsx](/Users/connor/.codex/worktrees/2c44/fairlendapp/src/test/lender/portfolio-cockpit.test.tsx:124) | Loading skeletons and inline empty/error states preserve the card footprint. |
| SATISFIED | capability | Render broker limits and CSV export together above suggested opportunities | [portfolio-shell.tsx](/Users/connor/.codex/worktrees/2c44/fairlendapp/src/components/lender/portfolio/portfolio-shell.tsx:48), [portfolio-export-strip.tsx](/Users/connor/.codex/worktrees/2c44/fairlendapp/src/components/lender/portfolio/portfolio-export-strip.tsx:57) | The lower strip hosts both broker-limit context and the export panel in the approved placement. |
| SATISFIED | contract | Use the server-generated ENG-310 export contract and disable with clear reasons | [portfolio-export-strip.tsx](/Users/connor/.codex/worktrees/2c44/fairlendapp/src/components/lender/portfolio/portfolio-export-strip.tsx:228), [LenderPortfolioPage.tsx](/Users/connor/.codex/worktrees/2c44/fairlendapp/src/components/lender/portfolio/LenderPortfolioPage.tsx:340) | Availability, permission, error, and unavailable-reason states come from the contract or auth gate. |
| SATISFIED | forbidden approach | Reuse the browser download helper instead of generating CSV in React | [portfolio-export-strip.tsx](/Users/connor/.codex/worktrees/2c44/fairlendapp/src/components/lender/portfolio/portfolio-export-strip.tsx:48) | The UI delegates file download to `downloadCsv` and never assembles CSV rows locally. |
| SATISFIED | copy | Avoid PDF or official tax-document language | [portfolio-export-strip.tsx](/Users/connor/.codex/worktrees/2c44/fairlendapp/src/components/lender/portfolio/portfolio-export-strip.tsx:149) | Copy stays CSV-first and does not imply T5/PDF issuance. |
| SATISFIED | scope | Keep the issue inside leaf components and avoid route-host ownership changes | [LenderPortfolioPage.tsx](/Users/connor/.codex/worktrees/2c44/fairlendapp/src/components/lender/portfolio/LenderPortfolioPage.tsx:85) | Route ownership stays in ENG-311; ENG-313 mounts leaf consumers into the existing shell. |
| SATISFIED | coverage | Add focused story/test coverage for the new surface states | [LenderPortfolioPage.stories.tsx](/Users/connor/.codex/worktrees/2c44/fairlendapp/src/components/lender/portfolio/LenderPortfolioPage.stories.tsx:14), [portfolio-cockpit.test.tsx](/Users/connor/.codex/worktrees/2c44/fairlendapp/src/test/lender/portfolio-cockpit.test.tsx:107), [snapshots.test.ts](/Users/connor/.codex/worktrees/2c44/fairlendapp/convex/portfolio/__tests__/snapshots.test.ts:158) | Storybook, focused cockpit/export tests, route coverage, and backend snapshot-history assertions cover the new projection surface and contract. |
| SATISFIED | validation | Repo validation commands pass | `bun check`, `bun typecheck`, `bunx convex codegen` command results | All required commands pass on the branch. |

## Next action
- None for ENG-313. The branch is ready for normal review/merge flow.
