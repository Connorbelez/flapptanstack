# Status: chunk-03-tests-validation-and-audit

- Result: complete
- Last updated: 2026-04-21T20:16:46Z

## Completed tasks
- T-200: Added snapshot coverage for reruns, zero-position lenders, exited-position history, current-period fallback, and the `months: 1` regression path.
- T-210: Added export coverage for availability metadata, stable CSV output, and live fallback behavior.
- T-220: Reran shared portfolio query coverage.
- T-900: Ran `bunx convex codegen`, `bun check`, and `bun typecheck`.
- T-910: Focused portfolio tests passed.
- T-980: Ran the spec-compliance audit against the current branch diff.
- T-990: Recorded the audit verdict and blocker state in `specs/ENG-310/audit.md`.

## Validation
- `bunx convex codegen`: passed
- `bun check`: passed
- `bun typecheck`: passed
- `bun run test -- convex/portfolio/__tests__/snapshots.test.ts convex/portfolio/__tests__/export.test.ts convex/portfolio/__tests__/queries.test.ts`: passed
- `python3 <path-to-validate_execution_artifacts.py> ENG-310 --repo-root "<repo-root>" --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`: pending rerun after artifact closeout

## Notes
- Audit and final artifact validation stay in this chunk so the closeout evidence remains localized.
- The local GitNexus CLI does not expose `detect_changes`, so scope review used `git diff --name-only HEAD`, `git ls-files --others --exclude-standard`, and `git diff --stat HEAD` as the fallback closeout evidence.
