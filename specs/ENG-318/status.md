# Execution Status: ENG-318 - Broker onboarding: build regulator lookup abstraction and FSRA import pipeline

- Overall status: complete
- Current phase: review-findings-addressed
- Current chunk: chunk-04-tests-audit
- Last updated: 2026-04-23 11:13:16 EDT

## Active focus
- Review findings are addressed and the ENG-318 validation gate is green.

## Blockers
- None.

## Notes
- The ENG-315 contract layer is extended with brokerage lookup and brokerage-association metadata while keeping lookup logic behind the provider boundary.
- `fsraLicenses`, `fsraSourceRows`, and `fsraImportRuns` exist in schema with reusable onboarding verification validators and focused import tests.
- The repo already has strong local analogues for this slice: transfer provider registry patterns, Rotessa read-model sync/run tracking, and centralized cron registration.
- GitNexus pre-edit impact:
  - `BrokerOnboardingRegulatorCheck`: MEDIUM, 8 direct onboarding-verification importers plus one downstream test file.
  - `RegulatorDirectoryProvider` / `interface.ts`: MEDIUM, 5 direct onboarding-verification importers plus 2 test files.
  - `schema.ts`: MEDIUM, imported by the Convex test harness and schema-driven metadata helpers.
  - `createImportedFsraRegulatorProvider`, `createMockRegulatorDirectoryProvider`, `createBrokerOnboardingVerificationRegistry`, and `crons.ts`: LOW.
- Chunk 01 complete:
  - Shared regulator contracts now support brokerage lookups and brokerage-association metadata.
  - `fsraLicenses` and `fsraImportRuns` exist in schema with reusable onboarding verification validators.
  - `bunx convex codegen` passed and `src/test/convex/onboarding/verification-contracts.test.ts` passed.
- Chunk 02 complete:
  - `fsraImport.ts` now owns normalized writes, local lookup bindings, run tracking, and the internal refresh action.
  - Mock regulator behavior is now fixture-backed instead of string-inference-based, which keeps it aligned with the imported-data slice.
  - `bunx convex codegen` passed and `src/test/convex/onboarding/verification-contracts.test.ts` still passed after the import/provider changes.
- Chunk 03 complete:
  - The shared internal refresh action now backs both the admin-triggered manual refresh and the daily cron registration.
  - `convex-test`'s static module loader map now includes the onboarding verification modules needed by the new focused suites.
  - `bun run test -- src/test/convex/onboarding/verification-contracts.test.ts src/test/convex/onboarding/fsra-import.test.ts src/test/convex/onboarding/regulator-provider.test.ts` passed.
- Chunk 04 complete:
  - `bunx convex codegen`, `bun check`, `bun typecheck`, and the focused onboarding verification suites all passed in the final validation sweep.
  - The refresh seam no longer seeds hidden fixture data; manual/admin imports take explicit normalized FSRA rows, cron imports staged rows in pages, replacement snapshots retire absent rows, and missing-source runs are recorded as failures in `fsraImportRuns`.
  - Review findings addressed: FairLend staff admin boundary, DB-backed imported lookup surfaces, replacement semantics, normalized brokerage comparisons, blank stable-ID rejection, brokerage lookup fallback, paged scheduled imports, stable snapshot null defaults, and row-keyed import failure diagnostics.
  - The spec audit verdict is `ready`.
