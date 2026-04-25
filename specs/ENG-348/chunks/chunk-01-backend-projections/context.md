# Chunk Context: chunk-01-backend-projections

## Goal
- Deliver server-owned buyer/seller queue and workspace projections with authorization, signing token scoping, document/package visibility, timeline, and completion receipt state.

## Relevant plan excerpts
- "Server-side Convex access checks are mandatory. Client filtering is not authorization."
- "Embedded signing tokens must be returned only for the authenticated current recipient and must never be exposed for other recipients or admin-only contexts."
- "Signable placeholders remain non-downloadable until the server says a signed/downloadable artifact is available."
- "Do not make completed receipts from deal status alone; use ENG-343 evidence."

## Implementation notes
- Existing `getPortalDealDetail` already composes deal, mortgage, property, participant projection, package surface, and close evidence.
- Existing `listEnvelopeProjection` already redacts embedded signing tokens except for an eligible authenticated recipient; workspace detail should consume equivalent server-owned logic or a narrower helper.
- Existing `buildDealParticipantProjection` provides normalized buyer/seller/lawyer/fraction data from ENG-338.
- Queue grouping must be based on projected lifecycle, signing task, blocker, and receipt state, not local React status math.

## Existing code touchpoints
- `convex/deals/queries.ts`: `getPortalDealDetail`, `getParticipantCloseReceipt`, close evidence helpers, deal phase helpers.
- `convex/deals/participantProjection.ts`: `buildDealParticipantProjection`, `mapDealAccessRoleToPortalPersona`, fraction projection.
- `convex/deals/envelopes.ts`: signing task/token eligibility helpers and envelope projection.
- `convex/documents/dealPackages.ts`: `readDealDocumentPackageSurface` and signable placeholder availability.
- `convex/authz/resourceAccess.ts`: `assertDealAccess`.
- GitNexus impact is required before modifying these symbols.

## Validation
- Targeted Convex tests for participant workspace projections and deal access.
- `bunx convex codegen`: not-run
- `bun check`: not-run
- `bun typecheck`: not-run
