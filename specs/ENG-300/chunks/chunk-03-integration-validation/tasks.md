# Chunk: chunk-03-integration-validation

- [x] T-030: Add targeted portal-pricing contract tests covering validator rules, date windows, overlap handling, projected-field boundaries, and fail-closed behavior
- [x] T-031: Add a thin integration proof that feeds real listing query fixtures through the shared portal-pricing helper without broad portal-listing query rollout
- [ ] T-900: Run `bunx convex codegen`, `bun check`, `bun typecheck`, targeted Vitest coverage, and `coderabbit review --plain`
- [x] T-910: Run `$linear-pr-spec-audit` against the current branch diff for `ENG-300`
- [ ] T-920: Resolve audit findings or record blockers, reconcile final scope with GitNexus and `git diff`, and close the execution checklist

T-900 note: targeted Vitest coverage and `bun typecheck` passed. `bunx convex codegen`, `bun check`, and `coderabbit review --plain` remain blocked by environment and repo-wide conditions.

T-920 note: blockers are recorded and the remaining scope is validation-only.
