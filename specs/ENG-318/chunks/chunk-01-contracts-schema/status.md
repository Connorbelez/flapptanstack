# Status: chunk-01-contracts-schema

- Result: complete
- Last updated: 2026-04-22 17:39:50 EDT

## Completed tasks
- T-010: Shared regulator lookup contracts now expose brokerage lookups, brokerage-association metadata, and typed source snapshots.
- T-020: `fsraLicenses` and `fsraImportRuns` landed in `convex/schema.ts` with reusable validators.

## Validation
- `bunx convex codegen`: pass
- `bun run test -- src/test/convex/onboarding/verification-contracts.test.ts`: pass

## Notes
- Contract extension is expected because the current seam does not expose brokerage lookup results yet.
- GitNexus pre-edit impact is medium on the shared contract/interface slice and medium on `schema.ts`, with no HIGH or CRITICAL blast radius detected.
