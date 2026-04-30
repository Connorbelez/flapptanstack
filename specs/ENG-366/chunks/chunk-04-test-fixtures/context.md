# Chunk Context: chunk-04-test-fixtures

## Goal
- Provide test seed fixtures for downstream File Workspace issues and verify they satisfy schema/access contracts.

## Relevant plan excerpts
- Seed one FairLend admin, one broker manager, one editor, one viewer, one non-participant, one active private box, one suspended box, one public-link box, and one magic-link box.

## Implementation notes
- Keep helpers test-focused and deterministic.
- Reuse existing `src/test/auth/helpers.ts` and identities where useful.
- Do not create production mutations for seeding.

## Existing code touchpoints
- New file: `convex/fileWorkspace/testUtils.ts`.
- Existing test helpers: `src/test/auth/helpers.ts`, `src/test/auth/identities.ts`.

## Validation
- `bun run test -- convex/fileWorkspace`
