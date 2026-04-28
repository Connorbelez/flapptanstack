# Chunk 05: ui e2e and validation

- [ ] T-050: Expand RTL listing launcher coverage for authorized start, disabled/error states, double-submit protection, missing hosted URL, mobile-safe control layout classes, and return-state rendering.
- [ ] T-051: Add or extend route tests proving authenticated wrappers gate suspense queries and return/expired/error state search params render from internal checkout state.
- [ ] T-052: Add Playwright marketplace smoke for authorized lender opening a listing, selecting fractions/lawyer, starting mocked hosted checkout, and observing hosted URL handoff.
- [ ] T-053: Add Playwright negative smoke for demo/ineligible listing that cannot launch checkout, including mobile viewport usability.
- [ ] T-054: Fix any listing UI, route auth, server wrapper, or E2E fixture defects revealed by T-050 through T-053.
- [ ] T-900: Run `bunx convex codegen` and commit any generated changes required by implementation edits.
- [ ] T-901: Run `bun check`, then address formatting/lint failures without bypassing the check.
- [ ] T-902: Run `bun typecheck` and fix all TypeScript errors.
- [ ] T-903: Run targeted checkout, webhook, deal package, listing route, and E2E tests introduced or changed by this issue.
- [ ] T-904: Run `bun run test`; run `bun run test:e2e` if browser coverage is included.
- [ ] T-905: Finalize AC4.x traceability and human audit notes for the PR.
