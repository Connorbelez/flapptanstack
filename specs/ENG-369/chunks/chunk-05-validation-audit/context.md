# Chunk Context: chunk-05-validation-audit

## Goal
- Run required quality gates, final execution-artifact validation, GitNexus change detection, and the `$linear-pr-spec-audit` release gate.

## Relevant plan excerpts
- Required commands: `bunx convex codegen`, `bun check`, `bun typecheck`, `bun run test -- convex/fileWorkspace src/test/convex/fileWorkspace`, `bun run test`.
- "Do not claim the issue is complete while the audit still has unresolved `MISSING` or `CONTRADICTED` items."
- "Run `gitnexus_detect_changes` before wrapping up or committing."

## Implementation notes
- E2E browser journeys are out of scope and covered by ENG-371.
- Storybook is not applicable because ENG-369 is backend-only and has no reusable UI changes.

## Existing code touchpoints
- `specs/ENG-369/audit.md`.
- `specs/ENG-369/execution-checklist.md`.
- GitNexus CLI may be used for local detect-changes equivalent if MCP tools are unavailable.

## Validation
- All commands listed in the execution checklist.
