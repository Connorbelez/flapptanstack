# Chunk Context: chunk-05-tests-validation-audit

## Goal
- Complete tests, run required quality gates, run GitNexus change detection, and persist the final spec audit.

## Relevant plan excerpts
- "Focused backend tests cover attempt creation, missing signatory config, valid completion, duplicate webhook, invalid webhook secret, rejection/void, provider mismatch, and reissue lineage."
- "Run `bunx convex codegen`, `bun check`, `bun typecheck`, targeted envelope/webhook tests, `bun run test`, and `bun run review` before completion."

## Implementation notes
- `bun check` must run before manual lint/format fixes because it auto-fixes some issues.
- Any repo-wide validation failures outside this diff must be recorded with concrete output and residual risk.
- `$linear-pr-spec-audit` is a release gate; unresolved `MISSING` or `CONTRADICTED` items block completion.

## Existing code touchpoints
- New tests likely under `src/test/convex/deals` or `convex/deals/__tests__`.
- Existing package tests in `src/test/convex/documents/dealPackages.test.ts`.

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- targeted tests
- `bun run test`
- `bun run review`
- GitNexus detect changes
- `$linear-pr-spec-audit`
