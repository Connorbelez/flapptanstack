# Chunk 01 Context

## Existing Code

- `convex/portals/helpers.ts` exposes `micPortalFields`, `MIC_PORTAL_LOCAL_HOST`, and `MIC_PORTAL_DEFAULT_POST_AUTH_PATH`.
- `convex/portals/micConfig.ts` resolves active MIC portals and their explicit `micLenderAuthId`.
- `convex/micPortfolio/queries.ts` derives MIC positions from `ledger_accounts.by_lender`, filters `POSITION` accounts with positive posted balances, and projects mortgage/listing/property/obligation data.
- `convex/micInvestorAccessRequests/mutations.ts` supports public request intake and admin approval/rejection through the transition engine.
- `convex/engine/effects/micInvestorAccessRequests.ts` provisions WorkOS user/membership and supports `setWorkosProvisioningForTests`.
- `src/test/convex/testKit.ts` is the canonical Convex test harness.
- `src/test/convex/portfolio-fixtures.ts` shows ledger bootstrap, mint, issue, and redeem patterns.
- `src/test/convex/micInvestorAccessRequests/helpers.ts` already has MIC portal and request helpers, but should be consolidated with the new scenario instead of duplicated further.

## Product Contract

- MIC portfolio truth comes from mortgage-ledger lender participation.
- MIC organization membership gates access, but does not define holdings.
- The v1 dashboard is read-only and not personalized.
- Do not show cap table, personalized holdings, cash-on-hand, NAV, treasury, or reserve metrics.

## Risk Notes

- `getMicDashboardSnapshot` currently calls `Date.now()` inside a query. If tests expose nondeterminism, prefer fixing that rather than asserting loose time behavior.
- Ledger helpers use idempotency keys. Fixture keys must be deterministic and unique per seeded mortgage to avoid cross-test collisions.
