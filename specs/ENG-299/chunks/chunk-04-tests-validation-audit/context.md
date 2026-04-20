# Chunk Context: chunk-04-tests-validation-audit

## Goal
- Close out the issue with targeted portal middleware tests, repo quality gates, final spec audit, and final execution artifact validation.

## Relevant plan excerpts
- Add tests for cross-portal denial, allowed same-portal access, and admin override.
- Add tests showing existing resource helpers are only evaluated after portal membership has passed.
- Run `bunx convex codegen`, `bun check`, `bun typecheck`, and targeted portal middleware tests.
- Update `ENG-299` contract wording so first-class borrower portal attribution is explicitly deferred to `ENG-302`.

## Implementation notes
- The highest-risk regression area is existing resource access behavior after actor-resolution extraction.
- E2E is only required if the implementation adds a real route consumer; otherwise targeted Convex and auth tests are sufficient and should be explicitly documented as such.
- Final audit must be recorded in `specs/ENG-299/audit.md` before the issue can be considered complete.

## Existing code touchpoints
- `convex/portals/__tests__/registry.test.ts`
- `convex/auth/__tests__/resourceChecks.test.ts`
- `src/test/auth/helpers.ts`
- `specs/ENG-299/audit.md`

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- targeted portal middleware/resource access tests
- `$linear-pr-spec-audit`
- Linear issue and Notion implementation plan reflect the approved `ENG-302` follow-up boundary
- `python3 /Users/connor/.codex/skills/linear-implement-v2/scripts/validate_execution_artifacts.py ENG-299 --repo-root "/Users/connor/.t3/worktrees/fairlendapp/t3code-3f717be5" --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`
