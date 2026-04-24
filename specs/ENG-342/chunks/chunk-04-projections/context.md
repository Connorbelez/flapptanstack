# Chunk Context: chunk-04-projections

## Goal
- Add shared signing projections for downstream admin/lawyer/participant surfaces and enrich existing package/deal surfaces safely.

## Relevant plan excerpts
- "Add access-checked projection queries for admin, lawyer, and participant consumers; embedded signing tokens must only be returned for the authenticated current recipient."
- "Integrate envelope state into package/deal projections without making signable placeholders downloadable before a server-available artifact exists."

## Implementation notes
- `getPortalDocumentPackage` currently filters to downloadable available rows; keep signable placeholders non-downloadable.
- `getPortalDealDetail` includes signable rows but forces URL null unless available non-signable/private static.
- Token visibility should compare authenticated viewer auth id to recipient auth id/email mapping server-side.

## Existing code touchpoints
- `convex/documents/dealPackages.ts`: `PackageSurface`, `buildPackageSurface`, `buildDownloadablePackageSurface`.
- `convex/deals/queries.ts`: `PortalDealDetail`, `projectPortalDealDocumentInstance`.
- `convex/authz/resourceAccess.ts`: `assertDealAccess` for participant reads.

## Validation
- Package/deal projection tests and token scoping tests.
