# Chunk 03: reconciliation and refunds

- [ ] T-030: Add webhook replay tests proving duplicate Stripe success and return polling cannot create duplicate checkout completions, transfers, refunds, deals, access rows, reservations, or packages.
- [ ] T-031: Add verified success-before-timeout coverage proving one lock-fee transfer, completed checkout state, idempotent replay, and downstream handoff readiness.
- [ ] T-032: Add payment failure inside TTL coverage proving retryable state keeps the reservation pending and does not extend TTL.
- [ ] T-033: Add success-after-timeout coverage proving no deal-ready success, refund intent/completion or retryable failure is recorded, and operations can inspect the outcome.
- [ ] T-034: Add metadata-conflict tests proving internal checkout state wins over tampered Stripe metadata.
- [ ] T-035: Fix any reconciliation, transfer, refund, webhook idempotency, or audit defects revealed by T-030 through T-034.
