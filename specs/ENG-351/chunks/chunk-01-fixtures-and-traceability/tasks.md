# Chunk 01: fixtures and traceability

- [ ] T-003: Create an AC4.x traceability matrix mapping every ENG-351 requirement to automated tests or named manual audit steps.
- [ ] T-004: Inventory existing Goal 4 tests and fixture helpers, then identify reusable setup seams for checkout start, expiry, reconciliation, deal package, and listing UI.
- [ ] T-010: Extract or add shared convex-test fixture helpers for a production portal, eligible lender, listing, mortgage, ledger inventory, platform lawyer, guest lawyer, and active private blueprint package.
- [ ] T-011: Add Stripe checkout event fixture builders covering success, failure, duplicate delivery, metadata tampering, missing metadata, and late success.
- [ ] T-012: Add checkout state fixture helpers for open, retryable, expired, abandoned, provider-start-failed, completed, and refunded-late-success sessions.
- [ ] T-013: Add audit/journal assertion helpers that can verify checkout start, provider failure, expiry, abandon, payment success/failure, refund, deal creation, package failure, and rejected transitions.
