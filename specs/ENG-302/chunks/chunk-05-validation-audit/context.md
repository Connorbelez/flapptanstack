# Chunk Context: chunk-05-validation-audit

## Goal
- Run repo quality gates, capture the final spec-audit verdict, and verify execution artifacts and GitNexus changed-scope checks before closeout.

## Relevant plan excerpts
- "`bunx convex codegen`, `bun check`, `bun typecheck`, and targeted portal/onboarding/borrower tests pass."
- "Invoke `$linear-pr-spec-audit` against the same issue and the current review target."

## Implementation notes
- `bun check` must run before ad hoc lint-fixing per repo instructions.
- Run `gitnexus_detect_changes` equivalent via CLI before wrap-up because MCP GitNexus tools are not exposed in this session.
- If e2e or Storybook remain untouched, record the explicit rationale in the checklist and final report rather than silently skipping them.

## Existing code touchpoints
- Whole change set plus `specs/ENG-302/audit.md`

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- Targeted Vitest suites for onboarding, origination, seeds, migrations, and portal middleware
- `python3 /Users/connor/.codex/skills/linear-implement-v2/scripts/validate_execution_artifacts.py ENG-302 --repo-root $(pwd) --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`
