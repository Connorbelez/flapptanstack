# Chunk Manifest: ENG-351 - Checkout: end-to-end race, expiry, refund, and audit hardening

Generated: 2026-04-27
Source: Linear ENG-351, attached implementation plan, linked upstream issue descriptions, local code inspection.

| Chunk | Tasks | Status | Notes |
| ----- | ----- | ------ | ----- |
| chunk-01-fixtures-and-traceability | T-003, T-004, T-010, T-011, T-012, T-013 | pending | AC matrix plus shared deterministic fixtures and assertion helpers |
| chunk-02-start-expiry-and-races | T-020, T-021, T-022, T-023, T-024 | pending | checkout start, provider failure, expiry, abandon, auth/tampering, races |
| chunk-03-reconciliation-and-refunds | T-030, T-031, T-032, T-033, T-034, T-035 | pending | Stripe success/failure, replay, polling, late-success refund, metadata conflicts |
| chunk-04-deal-package-and-audit | T-040, T-041, T-042, T-043, T-044, T-045 | pending | paid checkout to deal/package/access plus audit evidence |
| chunk-05-ui-e2e-and-validation | T-050, T-051, T-052, T-053, T-054, T-900, T-901, T-902, T-903, T-904, T-905 | pending | listing UI, route, browser smoke, final validation |

Status values: `pending` | `in-progress` | `complete` | `partial` | `blocked`
