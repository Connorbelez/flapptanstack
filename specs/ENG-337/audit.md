# Spec Audit: ENG-337 - Velocity package: add mock Velocity harness and backend regression coverage

- Audit skill: `$linear-pr-spec-audit`
- Review target: local branch diff for `ENG-337` in `/Users/connor/.codex/worktrees/51b1/fairlendapp`
- Last run: 2026-04-24 14:34:39 EDT
- Verdict: ready

## Findings
- none

## Unresolved items
- The Linear/Notion human audit checkpoint is manual by definition; automated backend coverage and repository validation are complete.
- `npx gitnexus detect-changes` is unavailable in this worktree (`unknown command 'detect-changes'`) and no GitNexus MCP detect-changes tool is exposed. Scope was checked with refreshed GitNexus index status, attempted symbol impact lookups, source inspection, `git diff --check`, codegen, typecheck, `bun check`, and focused Velocity tests.

## Resolved findings
- Named scenarios now carry explicit scenario expectations and reusable downstream instructions for missing PAD, incomplete bank data, Rotessa customer/schedule failure, retry/remediation, successful activation, final-review drift, and post-live drift. The generated Velocity deal also embeds the scenario metadata for ENG-335 reuse.
- Mock scenario delivery now persists webhook provenance and calls `velocity/sync:processVelocityFullDealSync`; regression coverage stubs the primary Velocity `/v1/deals` response empty and proves the sync falls back through `GET /api/dev/mock-velocity/v1/deals`.

## Next action
- Human review can proceed.
