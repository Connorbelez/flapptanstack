# Chunk Context: chunk-01-contracts-schema

## Goal
- Add reusable signing validators/types and first-class Convex schema tables for envelope attempts, recipients, provider events, exceptions, and lineage.

## Relevant plan excerpts
- "Add first-class envelope attempt schema/validators for `dealId`, `packageId`, `dealDocumentInstanceId`, `generatedDocumentId`, provider, provider document/envelope id, attempt number, status, recipient roster, active/superseded lineage, terminal reason, and timestamps."
- "Webhook ingestion must verify the Documenso secret before processing, persist the provider event id for idempotency, and only emit `ALL_PARTIES_SIGNED` after the required recipient set is verified complete across active attempts."

## Implementation notes
- Prefer explicit tables over storing complex signing state in `generatedDocuments.metadata`.
- Existing `dealDocumentInstances` already records signable placeholders with `signature_pending_recipient_resolution`.
- Existing `generatedDocuments` has `documensoEnvelopeId` and `signingStatus`; use it as linkage, not as the recipient roster.

## Existing code touchpoints
- `convex/documents/contracts.ts`: existing package/instance validators.
- `convex/schema.ts`: add new tables near deal document package tables.
- GitNexus: `processPackageWorkItem` LOW risk, `createDocumentPackageForDeal` LOW risk, `readDealDocumentPackageSurface` LOW risk.

## Validation
- `bunx convex codegen`
- Type-level compile coverage from `bun typecheck`
