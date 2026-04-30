# Chunk Context: chunk-02-schema

## Goal
- Add standalone File Workspace tables and indexes to Convex schema, plus smoke tests proving representative rows and key indexes compile.

## Relevant plan excerpts
- Core tables: `fileBoxes`, `fileBoxParticipants`, `fileNodes`, `fileVersions`, `fileShareLinks`, `fileComments`, `fileTags`, `fileNodeTags`, `fileActivityEvents`, and `fileSecurityEvents` or audit-log integration records.
- Required indexes must support box listing, participant lookup, active participant uniqueness, folder listing, sibling-name uniqueness checks, share-link lookup by token hash, version lookup by node, and activity/security feeds.
- Model boxes as top-level permission boundary with no foreign keys to deal, mortgage, CRM, listing, origination, or document-engine tables.

## Implementation notes
- Use validators from `convex/fileWorkspace/validators.ts`.
- Schema table rows store hashed link tokens only.
- Version row fields should make immutable data separate from scan/release transition fields.
- Prefer indexes with box-first shapes for scoped queries.

## Existing code touchpoints
- Existing edit: `convex/schema.ts`.
- Reference only: `recordAttachments` and `documentAssets` storage metadata tables.
- GitNexus impact required before editing `schema`/`defineSchema` surface.

## Validation
- `bunx convex codegen`
- `bun run test -- convex/fileWorkspace`
