# Chunk Context: chunk-04-validation-audit

## Goal
- Run required repository validation, run the final spec-compliance audit, persist the audit verdict, and close all execution artifacts only when supported by tests and checks.

## Relevant plan excerpts
- Validation commands: `bunx convex codegen`, `bun check`, `bun typecheck`, targeted Convex tests.
- Before finalizing, invoke `$linear-pr-spec-audit` against ENG-337 and the current branch diff, then persist the verdict in `specs/ENG-337/audit.md`.
- Do not claim completion with unresolved `MISSING` or `CONTRADICTED` audit items.

## Implementation notes
- Per repo instructions, run `bun check` before manually fixing lint/format issues because it auto-formats/fixes some diagnostics.
- E2E and Storybook are explicitly out of scope for ENG-337 unless implementation unexpectedly changes UI surfaces.
- Run `npx gitnexus detect-changes` or the available GitNexus equivalent before final wrap-up.

## Existing code touchpoints
- `specs/ENG-337/audit.md`
- `specs/ENG-337/execution-checklist.md`
- `specs/ENG-337/status.md`
- `specs/ENG-337/chunks/manifest.md`

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- Targeted Velocity tests
- Final execution-artifact validation
