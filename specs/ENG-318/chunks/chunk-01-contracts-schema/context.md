# Chunk Context: chunk-01-contracts-schema

## Goal
- Land the shared lookup contract changes and imported FSRA schema tables that every later chunk depends on.

## Relevant plan excerpts
- "Introduce a launch-ready imported-data source for Ontario FSRA license records that can answer both brokerage and individual license queries."
- "Preserve province in the schema and provider contracts even though launch only enables Ontario."
- "`fsraLicenses` must capture `licenseNumber`, `licenseeFullName`, optional `brokerageNumber`, optional `brokerageName`, `licenseType`, `status`, `province`, `lastVerifiedAt`, `sourceImportedAt`, and `rawRecord`."

## Implementation notes
- The current `RegulatorDirectoryProvider` seam only exposes `lookupLicense`; this chunk must extend the shared seam instead of inventing a second local regulator API.
- Launch remains Ontario-only, but the schema and provider contracts must keep province extensible.
- Keep downstream consumers on normalized lookup results and evidence references, not direct `rawRecord` parsing.

## Existing code touchpoints
- `shared/brokerOnboarding/contracts.ts`
- `convex/onboarding/verification/interface.ts`
- `convex/onboarding/verification/registry.ts`
- `convex/onboarding/verification/providers/importedFsra.ts`
- `convex/onboarding/verification/providers/mockRegulator.ts`
- `convex/schema.ts`

## Validation
- `bunx convex codegen`
- `bun run test -- src/test/convex/onboarding/verification-contracts.test.ts`
