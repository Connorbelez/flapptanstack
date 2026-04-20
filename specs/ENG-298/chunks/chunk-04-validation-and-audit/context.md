# Chunk Context: chunk-04-validation-and-audit

## Goal
- Run the repo quality gates, execute the final spec audit, reconcile any findings, and close the execution artifacts with an explicit pass or blocker record.

## Relevant plan excerpts
- "Do not claim the issue is complete while the audit still has unresolved `MISSING` or `CONTRADICTED` items."
- "Run `python3 scripts/validate_execution_artifacts.py <issue-key> --repo-root <repo-root> --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed` before claiming the issue is complete."
- "Run `gitnexus_detect_changes` before wrapping up or committing."

## Implementation notes
- Use the skill-bundled validation script path for artifact validation in this repo.
- If `bun check` or other repo-wide gates fail for unrelated reasons, record the exact blockers in the checklist, status, and audit artifacts rather than hand-waving them away.
- If GitNexus CLI still lacks a direct `detect_changes` command, use the available CLI status and diff reconciliation while recording that limitation explicitly.

## Existing code touchpoints
- `specs/ENG-298/*`
- Repo quality gate commands from `AGENTS.md`
- `$linear-pr-spec-audit`

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- Targeted auth tests
- Relevant E2E coverage
- `python3 /Users/connor/.codex/skills/linear-implement-v2/scripts/validate_execution_artifacts.py ENG-298 --repo-root /Users/connor/.codex/worktrees/e852/fairlendapp --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`
