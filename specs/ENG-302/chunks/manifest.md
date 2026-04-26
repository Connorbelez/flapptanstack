# Chunk Manifest: ENG-302 - Broker portal: add explicit borrower portal attribution on onboarding and borrower records

| Chunk | Tasks | Status | Notes |
| ----- | ----- | ------ | ----- |
| chunk-01-schema-onboarding | T-010, T-020 | complete | Schema fields/indexes plus onboarding request portal attribution; codegen and onboarding test slice passed |
| chunk-02-borrower-write-paths | T-030, T-040 | complete | Canonical borrower provisioning, origination entry points, and seed/direct inserts; codegen and origination/seed test slice passed |
| chunk-03-backfill-home-portal | T-050, T-060 | complete | Deterministic backfill plus borrower-driven home portal assignment cutover |
| chunk-04-middleware-tests | T-070, T-080 | complete | Explicit portal borrower enforcement and targeted regression coverage |
| chunk-05-validation-audit | T-900, T-910, T-920 | complete | Quality gates, spec audit, and closeout |
