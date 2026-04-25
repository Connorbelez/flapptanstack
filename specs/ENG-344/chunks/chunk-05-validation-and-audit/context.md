# Chunk Context: chunk-05-validation-and-audit

## Goal
- Run the required repo quality gates, GitNexus change detection, final spec audit, and artifact closeout without claiming completion until all open requirements are supported.

## Relevant plan excerpts
- Required commands: `bunx convex codegen`, `bun check`, `bun typecheck`, targeted Stripe webhook tests, targeted transfer request/cash-ledger mapping tests.
- "Before finalizing, invoke `$linear-pr-spec-audit` against the same issue and the current PR or branch diff, then persist the verdict in `specs/<issue-key>/audit.md`."

## Implementation notes
- Run `bun check` before manually fixing format/lint, per repository workflow.
- E2E and Storybook are recorded as not applicable for this backend/payment slice unless implementation expands into UI.
- `bun run test` is required if shared payment modules change broadly.

## Existing code touchpoints
- `specs/ENG-344/audit.md`.
- `scripts/validate_execution_artifacts.py`.
- GitNexus `detect_changes` or CLI equivalent before closeout.

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- Targeted tests for touched payment/checkout modules
- `$linear-pr-spec-audit`
- `python3 scripts/validate_execution_artifacts.py ENG-344 --repo-root "/Users/connor/.codex/worktrees/035e/fairlendapp" --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`
