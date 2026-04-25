# Chunk Context: chunk-01-portal-contract

## Goal
- Make MIC a normal portal registry type and expose the canonical portal-to-ledger mapping contract.

## Relevant plan excerpts
- `portalType: "fairlend" | "broker" | "mic"`
- MIC portal record contract: `slug: "mic"`, `productionHost: "mic.fairlend.ca"`, `localHost: "mic.localhost:3000"`, `orgId: string`, `defaultPostAuthPath: "/portal"`, `micLenderAuthId: string`.
- The MIC portal must be a normal portal record, not a host-specific special case.

## Implementation notes
- Prefer adding `micLenderAuthId` directly to `portals` unless code inspection shows a separate config table is cleaner.
- Existing broker pricing fields should remain optional for MIC.
- Existing duplicate slug/host behavior should continue to provide deterministic failure.

## Existing code touchpoints
- `convex/portals/validators.ts`: `portalTypeValidator`, portal summary validators.
- `convex/schema.ts`: `portals` table.
- `shared/portal/contracts.ts`: shared portal host/slug contract.
- `convex/portals/helpers.ts`: `buildPortalHosts`, FairLend portal helpers.
- `convex/admin/settings/actions.ts` and/or seed modules: likely place for admin/seed portal creation helpers.

## Validation
- GitNexus impact must be run before editing existing symbols.
- Targeted portal registry tests should cover MIC slug, production host, and local host without regressing broker/FairLend.
