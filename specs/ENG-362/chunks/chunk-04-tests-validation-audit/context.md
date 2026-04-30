# Chunk Context: chunk-04-tests-validation-audit

## Goal
- Run repository quality gates, complete the required spec audit, remediate gaps, and close the execution artifacts.

## Relevant plan excerpts
- "Run validation."
- "Before finalizing, invoke `$linear-pr-spec-audit` against the same issue and the current PR or branch diff."
- "Do not claim the issue is complete while the audit still has unresolved `MISSING` or `CONTRADICTED` items."

## Implementation notes
- Required repo gates from AGENTS: `bun check`, `bun typecheck`, and `bunx convex codegen`.
- Run `bun check` before manual lint/format fixes because it auto-formats/fixes some issues.
- Run `gitnexus_detect_changes` equivalent via GitNexus CLI before final wrap-up if MCP tool remains unavailable.

## Existing code touchpoints
- `scripts/validate_execution_artifacts.py`
- `$linear-pr-spec-audit` skill
- GitNexus CLI `detect changes` equivalent may need fallback if no dedicated CLI command exists.

## Validation
- `python3 scripts/validate_execution_artifacts.py ENG-362 --repo-root "/Users/connor/.codex/worktrees/a92c/fairlendapp" --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`
