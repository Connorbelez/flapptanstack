# Status: chunk-02-route-wiring

- Result: complete
- Last updated: 2026-04-25T16:21:22Z

## Completed tasks
- T-020: Added public `/start-lending` and `/start-lending/complete` handoff routes using active root portal context and host-aware sign-up redirects.
- T-021: Wired switchboard lender CTA, featured listing cards, and `View All` to canonical `/start-lending` URLs.
- T-022: Preserved teaser listing intent with `listingId` in the handoff URL while returning authenticated lenders to `/listings`.
- T-023: Updated Convex landing and route/component tests for canonical handoff URLs and linked teaser cards.

## Validation
- `bun run test -- src/test/routes/portal-home-route.test.tsx`: passed as part of targeted suite.
- route handoff tests: covered by portal landing route/component tests and Convex public contract tests.

## Notes
- Route generation completed with `bunx @tanstack/router-cli@1.166.4 generate`.
