# Chunk Context: chunk-02-schema

## Goal
- Add all dedicated Velocity package tables and indexes to `convex/schema.ts` using validators from `convex/velocity/validators.ts`.

## Relevant plan excerpts
- Tables required: `velocityPackageWorkspaces`, `velocityPackageSnapshots`, `velocityWebhookEvents`, `velocitySyncAttempts`, `velocityActivationAttempts`, `velocityPackageExceptions`, and `velocityPackageDocumentLinks`.
- Package document links must reference existing `documentAssets`.
- Activation attempts must record idempotency keys, actor identity, Rotessa references, bank account IDs, external customer/schedule IDs, and canonical mortgage links.

## Implementation notes
- Keep schema changes additive.
- Add indexes named in the contract unless local schema conventions require a directly equivalent name.
- Use `v.id("documentAssets")`, `v.id("users")`, `v.id("mortgages")`, `v.id("listings")`, `v.id("bankAccounts")`, `v.id("externalCustomerProfiles")`, and `v.id("externalCollectionSchedules")` for relations.

## Existing code touchpoints
- `convex/schema.ts` existing default schema export will be modified.
- GitNexus impact analysis is required before editing `convex/schema.ts`.

## Validation
- `bunx convex codegen`
- `bun typecheck`
