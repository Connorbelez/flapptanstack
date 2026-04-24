# Chunk Context: chunk-04-audit-closeout

## Goal
- Run the spec-compliance audit, close any remaining gaps, and verify that the finished diff matches the intended `ENG-312` scope.

## Relevant plan excerpts
- "Treat the audit as a release gate, not a nice-to-have review."
- "Do not claim the issue is complete while the audit still has unresolved `MISSING` or `CONTRADICTED` items."
- "Run `python3 scripts/validate_execution_artifacts.py <issue-key> --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed` before claiming the issue is complete."

## Implementation notes
- Audit against the current branch diff if no PR exists.
- Persist the verdict, top findings, and unresolved items into `specs/ENG-312/audit.md`.
- Use Git diff scope review and GitNexus checks where the available tooling can support them; do not claim a broader blast-radius verification than the environment actually provided.

## Existing code touchpoints
- `specs/ENG-312/audit.md` is the persistent audit record.
- `specs/ENG-312/tasks.md`, `execution-checklist.md`, and chunk task files must all be fully closed before final validation.
- The final scope review should compare changed portfolio UI files against the intended runtime-consumer and host-rendering scope for this issue.

## Validation
- `$linear-pr-spec-audit`: not-run
- final execution artifact validation: not-run
- diff-scope review: not-run
