# Chunk Context: chunk-03-tests-validation

## Goal
- Lock behavior with focused tests, run repo gates, run the final spec audit, and close execution artifacts.

## Relevant plan excerpts
- Component tests for final review rendering, blocker/warning presentation, and remediation state rendering.
- Route/integration tests for activation button enable/disable state driven by backend payloads.
- Edge tests for stale reviewed hashes, provider failure remediation, and unsupported mapping blockers.

## Implementation notes
- Prefer Vitest/RTL for page-level UI behavior because this slice is a route-backed React screen.
- E2E is likely deferred to ENG-335, which consumes this UI for operator workflow integration, unless a local browser flow is straightforward after implementation.
- Storybook is likely not applicable if new components are page-specific rather than reusable design-system surfaces.

## Existing code touchpoints
- `src/test/admin/velocity/*`: add UI tests.
- `src/test/convex/velocity/workspaces.test.ts`: update backend detail test.
- `specs/ENG-334/audit.md`: persist final audit verdict.

## Validation
- `bun check`
- `bun typecheck`
- `bunx convex codegen`
- targeted tests
- `$linear-pr-spec-audit`
- `python3 scripts/validate_execution_artifacts.py ENG-334 --repo-root "/Users/connor/.codex/worktrees/a048/fairlendapp" --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`
- GitNexus change detection before final report.
