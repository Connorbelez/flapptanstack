# Chunk Manifest: ENG-309 - Lender portfolio: register lender renewal intent in the transition engine

| Chunk | Tasks | Status | Notes |
| ----- | ----- | ------ | ----- |
| chunk-01-engine-runtime | T-010, T-011, T-012 | complete | governed types, new machine, registry wiring, and reconciliation alignment landed without touching `convex/engine/transition.ts` |
| chunk-02-portal-scheduler | T-020, T-021, T-022 | complete | portal-safe lender renewal reads/mutations plus idempotent creation and expiry scheduling are implemented under `convex/renewals/` |
| chunk-03-tests-validation | T-030, T-031, T-900, T-910, T-920 | complete | targeted renewal tests, repo gates, and final spec audit all ran successfully; GitNexus CLI lacked `detect-changes`, so final scope reconciliation used `git diff` plus earlier impact analysis |
