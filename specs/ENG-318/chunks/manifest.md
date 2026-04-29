# Chunk Manifest: ENG-318 - Broker onboarding: build regulator lookup abstraction and FSRA import pipeline

| Chunk | Tasks | Status | Notes |
| ----- | ----- | ------ | ----- |
| chunk-01-contracts-schema | T-010, T-020 | complete | Shared regulator contracts and FSRA schema/run tracking landed; codegen and verification-contracts tests passed. |
| chunk-02-import-provider | T-030, T-040, T-050, T-060 | complete | FSRA import/upsert helpers, imported-data lookup bindings, fixture-backed mock provider, and registry wiring landed. |
| chunk-03-refresh-surface | T-070, T-080 | complete | Shared refresh orchestration, admin manual refresh action, and daily FSRA cron are wired and covered by focused tests. |
| chunk-04-tests-audit | T-090, T-900, T-910, T-920 | complete | Repo gates and focused tests passed; audit closed with a manual-validation note for deployment-level FSRA source wiring. |
