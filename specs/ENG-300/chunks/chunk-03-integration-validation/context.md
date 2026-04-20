# Chunk Context: chunk-03-integration-validation

## Goal
- Prove the new pricing contract against real listing fixtures, then run the repo quality gates and the final spec audit.

## Relevant plan excerpts
- `Leave full portal listings query and route integration to ENG-301, but provide a proof seam or thin integration test so the helper contract is executable.`
- `No standalone E2E journey is required in this issue; end-to-end projected-value assertions land in the downstream portal listings consumer issue.`
- `bunx convex codegen`
- `bun check`
- `bun typecheck`

## Implementation notes
- Use existing listing query fixtures or Convex test harnesses to demonstrate helper reuse without widening the runtime surface prematurely.
- Final close-out still needs the audit pass and an explicit scope reconciliation because the local GitNexus CLI does not expose `detect_changes`.

## Existing code touchpoints
- `convex/portals/__tests__/pricing.test.ts` (new)
- `convex/listings/__tests__/queries.test.ts`
- `specs/ENG-300/audit.md`
- `specs/ENG-300/execution-checklist.md`

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- `bun run test -- convex/portals/__tests__/pricing.test.ts convex/listings/__tests__/queries.test.ts`
- `coderabbit review --plain`
