# Chunk: chunk-04-tests-validation-and-audit

- [x] T-030: Run `bunx convex codegen`
- [x] T-031: Run `bun check`
- [x] T-032: Run `bun typecheck`
- [x] T-033: Run targeted portal and listing tests for touched backend and frontend scope
- [x] T-034: Run `bun run test:e2e` if the updated portal listing route surface is runnable in this worktree
  Explicitly not run: no focused portal-listings Playwright flow exists in this checkout, so manual portal-host validation remains required.
- [x] T-035: Run GitNexus final scope detection and reconcile the change set against the execution checklist
  Reconciled with `git status --short` plus `git diff --stat eng-300` because the local CLI does not expose `gitnexus_detect_changes` and re-analysis did not finish in time.
- [x] T-910: Run `$linear-pr-spec-audit`
- [x] T-920: Resolve audit findings or record blockers
  Audit verdict is `needs manual validation`; no blocking code gaps remain in the local ENG-301 scope.
