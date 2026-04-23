# Chunk Context: chunk-05-audit-closeout

## Goal
- Run the final spec-compliance audit, close any remaining gaps, and verify the final changed scope and execution-artifact state before claiming ENG-314 is done.

## Relevant plan excerpts
- "Invoke `$linear-pr-spec-audit` against the same issue and the current review target."
- "Do not claim the issue is complete while the audit still has unresolved `MISSING` or `CONTRADICTED` items."
- "Run `gitnexus_detect_changes` before wrapping up or committing."
- "Run `validate_execution_artifacts.py ... --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed` before claiming the issue is complete."

## Implementation notes
- The audit verdict must be persisted into `specs/ENG-314/audit.md` with unresolved items called out explicitly.
- If the audit requires remediation, update tasks/checklist/manifest before touching any newly discovered scope.
- The final changed-scope review should confirm the diff stays inside the portfolio suggestion leaf slice and the expected tests/story coverage surfaces.

## Existing code touchpoints
- `specs/ENG-314/audit.md`
- `specs/ENG-314/status.md`
- `specs/ENG-314/execution-checklist.md`
- `gitnexus_detect_changes` for `/Users/connor/.codex/worktrees/10f8/fairlendapp`

## Validation
- `$linear-pr-spec-audit` for `ENG-314`
- `python3 /Users/connor/.codex/skills/linear-implement-v2/scripts/validate_execution_artifacts.py ENG-314 --repo-root "/Users/connor/.codex/worktrees/10f8/fairlendapp" --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`
- `gitnexus_detect_changes`
