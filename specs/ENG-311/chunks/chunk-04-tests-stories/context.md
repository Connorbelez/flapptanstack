# Chunk Context: chunk-04-tests-stories

## Goal
- Lock in the owned route baseline through tests and Storybook so downstream leaf issues can iterate without taking over the route shell contract.

## Relevant plan excerpts
- "Own the baseline `/lender/portfolio` route test; downstream issues should add focused leaf tests instead of competing for route-test ownership."
- TDD plan from Linear: add route/integration coverage for the command-center shell and row-to-sheet behavior, cover empty-state, unauthorized access, filter/sort controls, slot rendering, and desktop/mobile sheet behavior.
- Storybook is part of the repo and this issue introduces reusable portfolio shell and sheet components.

## Implementation notes
- Follow the mocking style from `src/test/routes/listings-route.test.tsx` and `src/test/routes/portal-home-route.test.tsx` for route context, query hooks, and query-option seams.
- Keep the test focused on route ownership: loader/query seam, shell composition order, empty-state safety, filter/sort wiring, and row-to-sheet orchestration.
- Add Storybook coverage for at least the default and empty portfolio page states so future leaf slices can verify the shell without recreating fixtures.
- Inspect the existing Playwright auth/portal harness before deciding whether dedicated e2e coverage is practical in this branch.

## Existing code touchpoints
- `src/test/routes/listings-route.test.tsx`: closest route-level testing pattern for loader + `useSuspenseQuery` + auth wrappers.
- `src/test/routes/portal-home-route.test.tsx`: existing root route context mocking pattern.
- `.storybook/main.ts`: Storybook picks up `../src/**/*.stories.@(js|jsx|mjs|ts|tsx)`.
- `playwright.config.ts` and `e2e/helpers/host-aware-auth.ts`: existing auth harness that determines whether `/lender/portfolio` can be exercised safely.

## Validation
- `bun run test -- src/test/routes/lender-portfolio-route.test.tsx`: pass
- `bun typecheck`: pass
