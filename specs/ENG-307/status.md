# Execution Status: ENG-307 - Broker landing page: add borrower and mortgage-applicant portal-attribution handoff

- Overall status: complete
- Current phase: final-validation
- Current chunk: none
- Last updated: 2026-04-25T19:45:12Z

## Active focus
- Implementation, focused validation, and spec audit are complete.

## Blockers
- none

## Notes
- ENG-302 is represented in the local checkout: explicit borrower `portalId` fields and `resolvePortalBorrower` by `by_portal_user` are present.
- GitNexus index is up to date for this worktree. Symbol/file impact target lookup did not resolve the landing symbols, so the implementation will use direct import/caller review plus targeted route/component tests as the fallback.
- Added public `/financing/start` and `/financing/pre-approval` continuation routes outside `/borrower`, with portal-only host policy and active portal assertions.
- Added route-owned financing continuation UI that preserves portal attribution, displays lightweight prefill, and uses `/sign-up?redirect=/borrower/financing/...` to cross the auth boundary only when the user continues.
- Added authenticated borrower continuation routes at `/borrower/financing/start` and `/borrower/financing/pre-approval`, so auth completion no longer returns borrowers to the public interstitial.
- Fixed production portal attribution display to use the resolved host instead of the portal's local development host.
- Fixed route-family toggle links to preserve lightweight prefill when switching between intake and pre-approval.
- The landing contract already pointed borrower actions at `/financing/start` and `/financing/pre-approval`; tests now lock the top-level CTA, nested pre-approval CTA, and inline strip prefill form behavior.
- No backend create/resume code was added because anonymous landing traffic should not create provisional application rows before identity.
- Quality gates passed: `bunx convex codegen`, `bun check`, `bun typecheck`, and focused route/component tests.
- Full `bun run test` was attempted and failed on unrelated existing suites: missing `marketplacePropertyType` fixtures, demo AMPS expectation drift, unrelated React hook dispatcher failures, existing auth architecture guard findings, existing single-paginate guard, and a transfer reconciliation admin role issue.
