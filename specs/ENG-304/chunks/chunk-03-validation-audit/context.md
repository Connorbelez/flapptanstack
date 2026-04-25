# Chunk Context: chunk-03-validation-audit

## Goal
- Run repository gates, run the final spec audit, fix or record audit findings, and validate the execution artifacts.

## Relevant plan excerpts
- "Run final `$linear-pr-spec-audit` against the same issue and current branch diff."
- "Do not claim complete while the audit still has unresolved MISSING or CONTRADICTED items."
- Required validation commands: `bunx convex codegen`, `bun check`, `bun typecheck`, targeted tests.

## Implementation notes
- Run `bun check` before manually addressing formatting lint fallout, per repo workflow.
- Run final artifact validation with `--require-audit --require-all-tasks-closed --require-all-checklist-closed`.
- GitNexus MCP is unavailable in the current tool surface; use local CLI equivalents and record the result.

## Existing code touchpoints
- `specs/ENG-304/audit.md`
- `specs/ENG-304/status.md`
- `specs/ENG-304/tasks.md`
- `specs/ENG-304/execution-checklist.md`

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- targeted tests
- `$linear-pr-spec-audit`
- final artifact validation
- `npx gitnexus impact`/change-scope equivalent
