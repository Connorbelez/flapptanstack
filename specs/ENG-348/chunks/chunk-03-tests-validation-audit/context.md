# Chunk Context: chunk-03-tests-validation-audit

## Goal
- Complete e2e coverage, required quality gates, final spec audit, and final execution artifact validation.

## Relevant plan excerpts
- Required commands: `bunx convex codegen`, `bun check`, `bun typecheck`, targeted participant route/query/component tests, `bun run test`, `bun run test:e2e`, `bun run review`.
- The final `$linear-pr-spec-audit` is a release gate; unresolved `MISSING` or `CONTRADICTED` items block completion.

## Implementation notes
- `bun check` must run before manual lint/format fixes because it auto-formats and fixes some lint errors.
- CodeRabbit review is human-owned and not part of the agent quality gate.
- Final artifact validation requires audit and all checklist/tasks closed.

## Existing code touchpoints
- `e2e` participant deal spec to create or update.
- `src/test` component/route tests.
- `convex/deals/__tests__` Convex tests.
- `specs/ENG-348/audit.md` and status/checklist/task artifacts.

## Validation
- `bunx convex codegen`: not-run
- `bun check`: not-run
- `bun typecheck`: not-run
- Targeted tests: not-run
- `bun run test`: not-run
- `bun run test:e2e`: not-run
- `bun run review`: not-run
- `$linear-pr-spec-audit`: not-run
