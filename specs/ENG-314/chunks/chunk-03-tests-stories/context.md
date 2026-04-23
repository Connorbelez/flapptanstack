# Chunk Context: chunk-03-tests-stories

## Goal
- Add focused UI verification for the suggested-opportunities leaf slice and capture whether dedicated Playwright coverage is practical in the current authenticated harness.

## Relevant plan excerpts
- "Add focused component/consumer coverage for the Suggested opportunities section."
- "Cover empty state, unavailable state, explanation-tag rendering, and already-owned exclusion behavior."
- "Focused tests and repo validation commands pass."
- "Suggested opportunities should explain why a listing matches the current portfolio profile and the broker-imposed constraints."

## Implementation notes
- The focused consumer test should own the section states; page-level route tests only need to prove the real section is integrated in the command-center surface.
- Storybook is appropriate because the section is a reusable portfolio leaf component with multiple presentation states.
- Dedicated Playwright coverage may remain impractical because ENG-314 reuses the existing authenticated listing/detail runtime and does not own deterministic e2e portfolio seeding; if so, record that explicitly in the artifacts rather than silently skipping it.

## Existing code touchpoints
- `src/test/routes/lender-portfolio-route.test.tsx` as a boundary reference only; ENG-314 should leave baseline route-test ownership with `ENG-311`.
- `src/components/lender/portfolio/LenderPortfolioPage.stories.tsx`
- `src/components/lender/portfolio/fixtures.ts`
- `convex/portfolio/__tests__/queries.test.ts`

## Validation
- `bun run test -- convex/portfolio/__tests__/queries.test.ts src/test/lender/portfolio-suggested-opportunities.test.tsx src/test/routes/lender-portfolio-route.test.tsx`
- `bun check`
