# Status: chunk-01-schema-and-gt

- Result: complete
- Last updated: 2026-04-22T22:06:23Z

## Completed tasks
- T-010
- T-011
- T-012

## Validation
- `bunx convex codegen`: passed
- targeted GT tests: passed (`convex/engine/machines/__tests__/brokerOnboardingApplication.machine.test.ts`, `convex/engine/machines/__tests__/registry.test.ts`)

## Notes
- This chunk must stay additive to the existing GT engine.
- `brokerOnboardings` wording in the architecture pages is stale; code should standardize on `brokerOnboardingApplication`.
- GitNexus impact for the planned touched existing symbols in this chunk is LOW.
