# Spec Audit: ENG-314 - Lender portfolio: ship bottom-of-page suggested opportunities

- Audit skill: `$linear-pr-spec-audit`
- Review target: local worktree diff against `HEAD` on the current stacked branch
- Last run: 2026-04-23T14:43:41Z
- Verdict: ready

## Findings
- none

## Resolved follow-up findings
- P2: `src/routes/lender.portfolio.tsx` no longer maps whole-query `isFetching` to suggested-opportunities loading, so valid empty snapshots keep rendering the ready empty explanation during background refreshes.
- P3: `src/components/lender/portfolio/suggested-opportunities.stories.tsx` now supplies deterministic fresh timestamps and a fixed story clock to non-stale stories while preserving the old timestamp only in the explicit `Stale` story.

## Unresolved items
- none

## Next action
- none
