# Chunk Context: chunk-05-validation-and-audit

## Goal
- Close ENG-329 with passing repo gates, a recorded spec-audit verdict, final execution-artifact validation, and a changed-scope sanity check.

## Relevant plan excerpts
- "Required commands: `bunx convex codegen`, `bun check`, `bun typecheck`, `bun run test -- src/test/lender/portfolio-rail.test.tsx`."
- "Treat the audit as a release gate, not a nice-to-have review."
- "Run `gitnexus_detect_changes` before wrapping up or committing."

## Implementation notes
- The final closeout should update `execution-checklist.md`, chunk statuses, `status.md`, and `audit.md` in the same session as the validation outcomes.
- If the spec audit still reports `MISSING` or `CONTRADICTED` items after the code is stable, fix them before claiming completion or explicitly mark ENG-329 blocked.
- The repo instructions require `bun check` before manual lint cleanups and require `bunx convex codegen` plus `bun typecheck` before closeout.

## Existing code touchpoints
- `specs/ENG-329/*`
- The final ENG-329 change set

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- `bun run test -- src/test/lender/portfolio-rail.test.tsx src/test/routes/lender-portfolio-route.test.tsx`
- `$linear-pr-spec-audit`
- `python3 "$LINEAR_IMPLEMENT_V2_ROOT/scripts/validate_execution_artifacts.py" ENG-329 --repo-root "$REPO_ROOT" --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`
