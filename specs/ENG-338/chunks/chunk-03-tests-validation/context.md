# Chunk Context: chunk-03-tests-validation

## Goal
- Complete access/resource coverage, run quality gates, perform the required spec audit, and close execution artifacts.

## Relevant plan excerpts
- "Deal reads require admin authority or active scoped access."
- "Duplicate grant calls do not create duplicate rows."
- "Revoked row does not authorize access."
- "External-org admin does not pass staff-global read paths."

## Implementation notes
- Run `bun check` before manual lint/format fixes, per repo instructions.
- Required final commands are `bunx convex codegen`, `bun check`, `bun typecheck`, targeted tests, `bun run test`, and `bun run review`.
- Run GitNexus change detection before final wrap-up.
- Persist `$linear-pr-spec-audit` verdict in `audit.md`.

## Existing code touchpoints
- `convex/deals/__tests__/access.test.ts`
- `convex/auth/__tests__/resourceChecks.test.ts`
- `specs/ENG-338/audit.md`
- `specs/ENG-338/status.md`
- `specs/ENG-338/execution-checklist.md`

## Validation
- All repo quality gates and final execution artifact validator.
