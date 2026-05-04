# Chunk Manifest: ENG-341 - Deal closing: create deals from verified listing-lock checkout

| Chunk | Tasks | Status | Notes |
| ----- | ----- | ------ | ----- |
| chunk-01-schema-and-contracts | T-010, T-011, T-012, T-013 | complete | checkout session validators, schema, additive deal metadata, codegen |
| chunk-02-checkout-start | T-020, T-021, T-022, T-023 | complete | authenticated listing lock start, reservation, Stripe checkout, expiry |
| chunk-03-webhook-success | T-030, T-031, T-032, T-033 | complete | verified Stripe success to idempotent deal creation |
| chunk-04-effects-compatibility | T-040, T-041, T-042 | complete | avoid duplicate reservation and lock-fee side effects |
| chunk-05-marketplace-ui | T-050, T-051, T-052 | complete | production listing detail CTA and UI states |
| chunk-06-validation-audit | T-900, T-901, T-902, T-903, T-904, T-905, T-906, T-907, T-910, T-920 | partial | quality gates pass except unrelated repo-wide test suite failures |
