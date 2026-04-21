# Chunk Manifest: ENG-301 - Broker portal: ship portal listing queries and thin route consumers

| Chunk | Tasks | Status | Notes |
| ----- | ----- | ------ | ----- |
| chunk-01-backend-portal-contracts | T-001, T-002, T-003, T-004, T-005 | complete | shared portal-aware listing snapshot seams landed with explicit portal query contracts and backend coverage |
| chunk-02-public-portal-teaser | T-010, T-011 | complete | root portal-host teaser consumer now uses portal query options and production listing components |
| chunk-03-lender-list-route-and-detail | T-020, T-021, T-022, T-023 | complete | `/lender/listings` and lender detail now consume explicit portal contracts through TanStack Query with route tests |
| chunk-04-tests-validation-and-audit | T-030, T-031, T-032, T-033, T-034, T-035, T-910, T-920 | complete | repo gates and targeted tests passed; audit verdict is `needs manual validation` because no focused portal-listings Playwright flow exists here |
