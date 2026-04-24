# Chunk: chunk-03-tests-validation

- [x] T-031: Extend access tests for active scoped access, revoked access denial, platform and guest lawyer access, idempotent grants, role changes, and history preservation.
- [x] T-032: Extend resource-check tests for staff admin versus external admin and normalized deal access outcomes.
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted backend/component tests.
- [x] T-904: Run `bun run test`.
- [x] T-905: Run `bun run review`.
- [x] T-906: Run `gitnexus_detect_changes` or CLI equivalent.
  - Note: local GitNexus CLI has no `detect-changes` command; impact checks, `npx gitnexus analyze --skip-agents-md --no-stats`, and `git diff --stat` were used for scope review instead.
- [x] T-910: Run `$linear-pr-spec-audit` against `ENG-338` and the current branch diff.
- [x] T-920: Resolve audit findings or record blockers.
- [x] T-930: Run final execution artifact validation with audit and all tasks/checklist closed.
