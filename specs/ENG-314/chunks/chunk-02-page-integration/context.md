# Chunk Context: chunk-02-page-integration

## Goal
- Wire the shipped suggested-opportunities section into the existing portfolio command-center page and align the local fixtures with the real section states.

## Relevant plan excerpts
- "Keep Suggested opportunities at the bottom of `/lender/portfolio`."
- "Leave route-shell ownership, the shared query seam, and the baseline route test to ENG-311."
- "Suggested opportunities live at the bottom of the page and explain why each listing matches the current portfolio profile."
- "Suggested opportunities remain anchored below the export strip so positions and payment activity stay ahead of prospecting work."

## Implementation notes
- `PortfolioShell` already renders `suggestedOpportunitiesSlot` after `exportStripSlot`; ENG-314 should replace only the placeholder slot content, not the shell ordering itself.
- The page integration should keep drill-down navigation pointing at the existing `/listings/$listingId` runtime.
- Fixture updates should cover at least one populated state plus explicit no-results and stale-data scenarios so tests and Storybook do not need to mutate the same base object repeatedly.

## Existing code touchpoints
- `src/components/lender/portfolio/LenderPortfolioPage.tsx`
- `src/components/lender/portfolio/fixtures.ts`
- `src/components/lender/portfolio/LenderPortfolioPage.stories.tsx`
- `src/components/lender/portfolio/portfolio-shell.tsx`

## Validation
- `bun run test -- src/test/routes/lender-portfolio-route.test.tsx src/test/lender/portfolio-suggested-opportunities.test.tsx`
- `bun check`
