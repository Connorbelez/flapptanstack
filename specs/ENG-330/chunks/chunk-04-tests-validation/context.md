# Chunk Context: chunk-04-tests-validation

## Goal
- Lock the Velocity contract foundation with focused tests and complete all required quality gates, spec audit, and change detection.

## Relevant plan excerpts
- Validation commands: `bunx convex codegen`, `bun check`, `bun typecheck`, and targeted contract/schema tests for Velocity validators, enums, and helper builders.
- Before finalizing, run `$linear-pr-spec-audit` and persist the verdict in `specs/ENG-330/audit.md`.
- Run GitNexus change detection before closeout.

## Implementation notes
- Tests should cover status semantics, enum maps, supported/unsupported payment frequency mappings, idempotency key builders, activation-remediation fields, and namespace exports.
- E2E and Storybook are not applicable because there is no UI or operator workflow in this issue.

## Existing code touchpoints
- New targeted test file: `src/test/convex/velocity/contracts.test.ts`.
- `specs/ENG-330/audit.md` must be updated after audit.

## Validation
- targeted Velocity tests
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- final execution artifact validation
- GitNexus change detection
