# Chunk Manifest: ENG-299 - Broker portal: enforce portal membership in Convex middleware

| Chunk | Tasks | Status | Notes |
| ----- | ----- | ------ | ----- |
| chunk-01-actor-resolution-and-impact | T-001, T-005, T-010 | complete | actor lookups extracted to reusable auth helpers with no resource-check semantic drift |
| chunk-02-portal-middleware | T-020, T-030 | complete | portal reload, access, lender, and borrower middleware landed with typed context and fail-closed guards |
| chunk-03-builders-and-proof | T-040, T-050, T-060 | complete | portal-aware builders and proof consumers landed without widening resource-level access checks |
| chunk-04-tests-validation-audit | T-070, T-080, T-900, T-901, T-902, T-903, T-904, T-910, T-920, T-930 | complete | targeted tests and repo gates passed; CodeRabbit full-branch mode blocked by stack size but audit closeout is complete |
