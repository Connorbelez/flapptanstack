# Chunk Manifest: ENG-299 - Broker portal: enforce portal membership in Convex middleware

| Chunk | Tasks | Status | Notes |
| ----- | ----- | ------ | ----- |
| chunk-01-actor-resolution-and-impact | T-001, T-005, T-010 | complete | actor lookups extracted to reusable auth helpers with no resource-check semantic drift |
| chunk-02-portal-middleware | T-020, T-030 | complete | portal reload, access, lender, and borrower middleware landed with typed context and fail-closed guards |
| chunk-03-builders-and-proof | T-040, T-045, T-046, T-047, T-050, T-051, T-060 | complete | builders now inject structural portal context, lender access is broker-only, and borrower access uses the transitional by-org mapping pending `ENG-302` |
| chunk-04-tests-validation-audit | T-070, T-071, T-080, T-905, T-906, T-907, T-908, T-909, T-911, T-912, T-920, T-931 | complete | targeted tests, repo gates, contract verification, rerun audit, and final artifact validation are all complete |
