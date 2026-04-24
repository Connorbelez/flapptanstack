# Spec Audit: ENG-312 - Lender portfolio: ship renewal actions inside the rail and position sheet

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff against its actual base (no PR opened yet)
- Last run: 2026-04-23T16:45:01Z
- Verdict: ready

## Findings
- `SATISFIED`: stale-state refresh now reconciles local partial-exit draft state against a remote renewal state key, so a remote intent change collapses stale local partial-exit UI even when `partial_exit` remains an allowed follow-up choice.
- `SATISFIED`: focused automated coverage now includes a regression for stale draft reconciliation in `src/test/lender/portfolio-renewals.test.tsx`, alongside the existing renewal helper and component coverage.
- `SATISFIED`: the rail host and position sheet both mount the same `RenewalActionSurface`, so the governed renewal state and available choices stay aligned across both hosts.
- `SATISFIED`: the implementation stays within scope: no dedicated renewal route was added, and the governed runtime in `ENG-309` remains the source of truth for renewal status, available actions, and change-intent affordances.
- `SATISFIED`: partial-exit validation remains thin and runtime-driven. The UI validates only numeric bounds supplied by the runtime (`partialExitMinimumFractions`, `currentHeldFractions`) instead of duplicating transition rules locally.
- `SATISFIED`: `@convex-dev/react-query` is reactive by design, so the renewal consumer and the existing command-center/position-detail queries refresh through subscriptions rather than manual `invalidateQueries()` calls.

## Unresolved items
- none

## Next action
- Issue is ready from the stale-refresh and regression-coverage perspective.
