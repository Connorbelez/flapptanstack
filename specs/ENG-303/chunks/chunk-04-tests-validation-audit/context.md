# Chunk Context: chunk-04-tests-validation-audit

## Goal
- Prove the contract behavior with tests, run required repo gates, run the final spec audit, and close artifacts.

## Relevant plan excerpts
- "Add or update targeted tests around portal query shaping and fallback behavior."
- "`bunx convex codegen`, `bun check`, `bun typecheck`."
- "Before finalizing, invoke `$linear-pr-spec-audit`."

## Implementation notes
- Add tests under `convex/portals/__tests__/landing.test.ts`.
- Cover broker fallback, FairLend portal fallback, landing-copy override, nested pre-approval shape, disabled teaser, and portal-priced teaser listing projection.
- E2E and Storybook are expected inapplicable unless visual rendering work is added.

## Existing code touchpoints
- `convex/portals/__tests__/registry.test.ts` and `convex/listings/__tests__/marketplace.test.ts` provide convex-test fixture patterns.
- `convex/test/moduleMaps.ts` exports Convex modules for tests.

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- targeted Vitest command for portal landing tests
- `$linear-pr-spec-audit ENG-303`
- final artifact validator
