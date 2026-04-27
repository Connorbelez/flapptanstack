# Status: chunk-02-application-surfaces

- Result: complete
- Last updated: 2026-04-22T22:06:23Z

## Completed tasks
- T-020
- T-021
- T-022
- T-023

## Validation
- targeted aggregate tests: passed (`src/test/convex/onboarding/brokerApplication.aggregate.test.ts`)
- targeted handoff tests: passed (`src/test/convex/onboarding/brokerApplication.handoff.test.ts`)

## Notes
- This chunk should reuse shared verification contracts from `ENG-315`.
- Portal attribution must follow the existing trusted-home-portal pattern rather than inventing a broker-onboarding-specific host resolver.
