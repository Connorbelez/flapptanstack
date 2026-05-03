# Chunk Context: chunk-04-tests-and-stories

## Goal
- Prove the rail/chat slice works in isolation with focused tests and surface the key reusable UI states in Storybook.
- Record whether the current Playwright auth and portal harness can realistically cover this slice.

## Relevant plan excerpts
- "Add focused rail/chat coverage for rendering, fallback states, and contextual handoff behavior."
- "Cover all-clear state, unavailable-chat state, missing-broker state, and action-to-chat prefill behavior."
- "Focused rail and chat tests plus repo validation commands pass."

## Implementation notes
- The existing route test already owns the baseline `/lender/portfolio` route seam; ENG-329 should add a focused rail/chat test file instead of overloading that baseline suite with all leaf-state assertions.
- Storybook coverage can stay on `LenderPortfolioPage` if the added stories make the leaf states explicit.
- If Playwright is still impractical, record the reason directly in `execution-checklist.md`, `status.md`, and the relevant chunk status.

## Existing code touchpoints
- `src/test/lender/portfolio-rail.test.tsx`
- `src/test/routes/lender-portfolio-route.test.tsx`
- `src/components/lender/portfolio/LenderPortfolioPage.stories.tsx`
- `src/components/lender/portfolio/fixtures.ts`

## Validation
- `bun run test -- src/test/lender/portfolio-rail.test.tsx src/test/routes/lender-portfolio-route.test.tsx`
