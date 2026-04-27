# Status: chunk-01-contracts-and-policy

- Result: complete
- Last updated: 2026-04-22T19:37:58Z

## Completed tasks
- T-010
- T-011
- T-012

## Validation
- `src/test/convex/onboarding/verification-contracts.test.ts`: passed
- `bun typecheck`: passed
- `bunx convex codegen`: passed
- `bun check`: passed

## Notes
- This chunk should remain additive and avoid wiring business-layer call sites until the contract names are frozen.
- Pre-edit impact analysis did not identify any high-risk existing symbol changes for this chunk; the broader auth-role blast radius sits in later permission-catalog work.
- New files added in this chunk: `shared/brokerOnboarding/contracts.ts`, `convex/onboarding/verification/interface.ts`, and `convex/onboarding/verification/config.ts`.
- Contract names, normalized snapshot helpers, and typed config ownership are validated by the focused tests and repo gates.
