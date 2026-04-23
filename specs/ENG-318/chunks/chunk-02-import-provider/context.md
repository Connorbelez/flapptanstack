# Chunk Context: chunk-02-import-provider

## Goal
- Build the normalization/upsert pipeline plus imported-data and mock providers that emit the same normalized lookup semantics.

## Relevant plan excerpts
- "Implement a typed normalization pipeline that converts raw source rows into a canonical FSRA record shape and upserts by stable identifier instead of blind inserts."
- "Implement the imported-data regulator provider against `fsraLicenses` using the shared `RegulatorDirectoryProvider` contract from ENG-315."
- "Implement deterministic mock fixtures and a mock regulator provider that match the imported-data provider's normalized brokerage and individual lookup results."
- "Map data older than 7 days to explicit stale or verification-unavailable outcomes that downstream verification can turn into review-needed rather than hard rejection."

## Implementation notes
- Reuse the Rotessa read-model pattern for normalization and idempotent upserts, but keep FSRA code isolated from payments naming and tables.
- The imported-data provider should read local data only and expose optional source snapshots through normalized evidence/snapshot fields.
- Mock fixtures must be deterministic and cover active match, not-found, suspended, stale, and brokerage-mismatch cases.

## Existing code touchpoints
- `convex/onboarding/verification/fsraImport.ts` (new)
- `convex/onboarding/verification/providers/importedFsra.ts`
- `convex/onboarding/verification/providers/mockRegulator.ts`
- `convex/onboarding/verification/registry.ts`
- `convex/onboarding/verification/config.ts`
- `convex/payments/rotessa/readModel.ts`

## Validation
- `bun run test -- src/test/convex/onboarding/fsra-import.test.ts src/test/convex/onboarding/regulator-provider.test.ts`
