# Tasks: ENG-351 - Checkout: end-to-end race, expiry, refund, and audit hardening

Generated: 2026-04-27
Source: Linear ENG-351, attached implementation plan, linked upstream issue descriptions, and local code inspection.

## Status Rules
- Keep task IDs stable.
- Add newly discovered defect-fix tasks before editing implementation code.
- Do not weaken tests to match broken behavior; fix implementation or record a blocker.
- Run impact analysis before editing existing symbols if GitNexus becomes available.

## Phase 1: Planning And Traceability
- [x] T-001: Fetch ENG-351 Linear issue context, attachments, upstream dependency descriptions, and comments.
- [x] T-002: Attempt Notion and GitNexus context gathering; record authenticated-tool blockers and fallback context sources.
- [ ] T-003: Create an AC4.x traceability matrix mapping every ENG-351 requirement to automated tests or named manual audit steps.
- [ ] T-004: Inventory existing Goal 4 tests and fixture helpers, then identify reusable setup seams for checkout start, expiry, reconciliation, deal package, and listing UI.

## Phase 2: Fixtures And Harnesses
- [ ] T-010: Extract or add shared convex-test fixture helpers for a production portal, eligible lender, listing, mortgage, ledger inventory, platform lawyer, guest lawyer, and active private blueprint package.
- [ ] T-011: Add Stripe checkout event fixture builders covering success, failure, duplicate delivery, metadata tampering, missing metadata, and late success.
- [ ] T-012: Add checkout state fixture helpers for open, retryable, expired, abandoned, provider-start-failed, completed, and refunded-late-success sessions.
- [ ] T-013: Add audit/journal assertion helpers that can verify checkout start, provider failure, expiry, abandon, payment success/failure, refund, deal creation, package failure, and rejected transitions.

## Phase 3: Start, Expiry, Auth, And Race Coverage
- [ ] T-020: Add a deterministic final-fractions race test proving one buyer succeeds, one fails with `insufficient_fractions`, and no dangling reservation/session remains.
- [ ] T-021: Expand provider-start failure coverage to assert checkout `provider_start_failed`, reservation voiding, availability restoration, and audit evidence.
- [ ] T-022: Expand expiry/abandon tests to cover provider expiry success/failure, duplicate sweeps, success-vs-expiry race behavior, and ledger-derived availability restoration.
- [ ] T-023: Add checkout start auth/tampering tests for unauthenticated, non-lender, wrong portal, hidden-by-filter listing, demo listing, tampered availability, tampered fee, tampered lawyer label, and tampered Stripe metadata.
- [ ] T-024: Fix any checkout start, expiry, ledger reservation, portal visibility, or audit defects revealed by T-020 through T-023.

## Phase 4: Reconciliation, Duplicate Delivery, And Refunds
- [ ] T-030: Add webhook replay tests proving duplicate Stripe success and return polling cannot create duplicate checkout completions, transfers, refunds, deals, access rows, reservations, or packages.
- [ ] T-031: Add verified success-before-timeout coverage proving one lock-fee transfer, completed checkout state, idempotent replay, and downstream handoff readiness.
- [ ] T-032: Add payment failure inside TTL coverage proving retryable state keeps the reservation pending and does not extend TTL.
- [ ] T-033: Add success-after-timeout coverage proving no deal-ready success, refund intent/completion or retryable failure is recorded, and operations can inspect the outcome.
- [ ] T-034: Add metadata-conflict tests proving internal checkout state wins over tampered Stripe metadata.
- [ ] T-035: Fix any reconciliation, transfer, refund, webhook idempotency, or audit defects revealed by T-030 through T-034.

## Phase 5: Deal, Package, Access, And Audit Handoff
- [ ] T-040: Add full paid-checkout handoff coverage proving exactly one deal, package, access set, checkout/deal linkage, reservation linkage, lock-fee transfer linkage, and Stripe reference set.
- [ ] T-041: Add package handoff coverage proving active private blueprints are snapshotted and `lender_primary` / `lawyer_primary` resolve from checkout participants for platform and guest lawyer paths.
- [ ] T-042: Add idempotent retry coverage for duplicate webhook plus return-polling handoff and deal insert succeeds / package generation fails / retry repairs package scenarios.
- [ ] T-043: Add access boundary coverage proving selected lawyer has scoped access to only the created deal and unrelated users/deals are denied.
- [ ] T-044: Assert audit evidence for deal creation, duplicate replay, package failure, access failure, and rejected handoff transitions.
- [ ] T-045: Fix any deal handoff, package generation, access, reservation effect, or audit defects revealed by T-040 through T-044.

## Phase 6: Listing UI, Route, Mobile, And E2E Smoke
- [ ] T-050: Expand RTL listing launcher coverage for authorized start, disabled/error states, double-submit protection, missing hosted URL, mobile-safe control layout classes, and return-state rendering.
- [ ] T-051: Add or extend route tests proving authenticated wrappers gate suspense queries and return/expired/error state search params render from internal checkout state.
- [ ] T-052: Add Playwright marketplace smoke for authorized lender opening a listing, selecting fractions/lawyer, starting mocked hosted checkout, and observing hosted URL handoff.
- [ ] T-053: Add Playwright negative smoke for demo/ineligible listing that cannot launch checkout, including mobile viewport usability.
- [ ] T-054: Fix any listing UI, route auth, server wrapper, or E2E fixture defects revealed by T-050 through T-053.

## Phase 9: Validation And Completion
- [ ] T-900: Run `bunx convex codegen` and commit any generated changes required by implementation edits.
- [ ] T-901: Run `bun check`, then address formatting/lint failures without bypassing the check.
- [ ] T-902: Run `bun typecheck` and fix all TypeScript errors.
- [ ] T-903: Run targeted checkout, webhook, deal package, listing route, and E2E tests introduced or changed by this issue.
- [ ] T-904: Run `bun run test`; run `bun run test:e2e` if browser coverage is included.
- [ ] T-905: Finalize AC4.x traceability and human audit notes for the PR.
