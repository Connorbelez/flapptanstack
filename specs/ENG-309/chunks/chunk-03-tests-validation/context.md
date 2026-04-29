# Chunk Context: chunk-03-tests-validation

## Goal
- Prove the renewal runtime with focused tests, run the repo quality gates, and finish the required spec-audit and scope-reconciliation closeout work.

## Relevant plan excerpts
- `Add focused machine, registry, transition, and portal command-surface tests.`
- `No route or integration tests are required in this issue unless the implementation touches shared route loaders or query helpers.`
- `E2E tests: None required here; the renewal UI issue will own browser-level flows.`
- `bunx convex codegen`
- `bun check`
- `bun typecheck`

## Implementation notes
- This issue owns backend/runtime behavior only, so Storybook and browser E2E are expected to stay out of scope unless implementation drift changes that assumption.
- The final closeout must include the required `$linear-pr-spec-audit`.
- AGENTS.md requires GitNexus scope verification before wrap-up or commit. The local CLI may still lack `detect_changes`, so explicit `git diff` reconciliation is the fallback if needed.
- If repo-wide quality gates fail on unrelated files, record that precisely in the artifacts rather than falsely closing checklist items.

## Existing code touchpoints
- `convex/engine/machines/__tests__/lenderRenewalIntent.machine.test.ts`
- `convex/engine/machines/__tests__/registry.test.ts`
- `src/test/convex/engine/transition.test.ts`
- `src/test/convex/engine/crossEntity.test.ts` if cross-entity scheduler behavior lands there
- new renewal portal and scheduler test files
- `specs/ENG-309/audit.md`

## Validation
- `bun run test -- convex/engine/machines/__tests__/lenderRenewalIntent.machine.test.ts convex/engine/machines/__tests__/registry.test.ts src/test/convex/engine/transition.test.ts src/test/convex/engine/crossEntity.test.ts`
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
