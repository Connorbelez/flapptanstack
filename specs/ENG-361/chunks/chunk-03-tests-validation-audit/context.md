# Chunk Context: chunk-03-tests-validation-audit

## Goal
- Prove ENG-361 requirements with focused tests, repo quality gates, Linear spec audit, and final artifact validation.

## Relevant plan excerpts
- Required commands: `bunx convex codegen`, `bun check`, `bun typecheck`, targeted legalRepresentation platform lawyer tests, targeted listing checkout tests if checkout option source changes.
- Tests must cover admin authorization, status projection, checkout filtering, and duplicate auth ID behavior.

## Implementation notes
- Use `convex-test` patterns from `convex/legalRepresentation/__tests__/contracts.test.ts` and listing tests under `src/test/listings`.
- E2E can be explicitly justified as not applicable if no browser-visible flow changes beyond backend data source.
- Storybook can be explicitly justified as not applicable if no reusable UI components or visual states change.

## Existing code touchpoints
- `convex/legalRepresentation/__tests__/contracts.test.ts`
- new `convex/legalRepresentation/__tests__/platformLawyers.test.ts`
- `src/test/listings/listing-detail-checkout.test.tsx`

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- targeted tests
- `$linear-pr-spec-audit`
- final artifact validation
