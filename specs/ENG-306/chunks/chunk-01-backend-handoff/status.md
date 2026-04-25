# Status: chunk-01-backend-handoff

- Result: complete
- Last updated: 2026-04-25T16:21:22Z

## Completed tasks
- T-010: Added `convex/onboarding/lenderLanding.ts` public fluent Convex mutation to create or resume active lender onboarding records.
- T-011: Validated canonical landing entry paths, optional listing ids, authenticated email, active portal state, and broker attribution.
- T-012: Added Convex tests for create, resume, listing attribution, and suspended-portal fail-closed behavior.

## Validation
- `bun run test -- convex/onboarding/__tests__/lenderLanding.test.ts`: passed as part of targeted suite.
- `bunx convex codegen`: passed.

## Notes
- Ready-to-edit artifact validation passed.
- GitNexus impact was LOW for `HomeContent`, `getHostAwareAuthUrl`, `buildPortalAuthStatePayload`, and `resolveRootPortalContext`; newer landing symbols were not indexed.
