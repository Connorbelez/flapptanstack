# Tasks: ENG-341 - Deal closing: create deals from verified listing-lock checkout

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Gather Linear issue, comments, labels, relations, implementation plan, ENG-338 supporting contract, and architecture docs.
- [x] T-002: Scaffold execution artifacts with `scripts/init_execution_artifacts.py`.
- [x] T-003: Register/analyze this worktree with GitNexus and run initial impact checks for expected existing symbols.
- [x] T-004: Validate execution artifacts at `ready-to-edit` before implementation edits.

## Phase 2: Schema And Contracts
- [x] T-010: Add checkout session validators/constants for status, CAD 250 lock fee, five-minute expiry, selected lawyer type, Stripe metadata, and start-checkout input.
- [x] T-011: Add `dealLockCheckoutSessions` schema table with indexes by Stripe checkout id, listing/buyer/status, status/expiresAt, deal id, and idempotency key.
- [x] T-012: Add additive deal metadata for externally collected lock fee and Stripe checkout/payment identifiers without changing existing participant/fraction storage semantics.
- [x] T-013: Regenerate Convex types after schema and module additions.

## Phase 3: Checkout Start
- [x] T-020: Implement pure helpers that re-read and validate published listing, mortgage linkage, availability, fraction units, buyer/seller identity, and selected lawyer.
- [x] T-021: Implement checkout-start mutation/action split that requires authenticated lender access, creates or reuses temporary ledger reservation with stable idempotency, creates Stripe Checkout, persists session, and returns redirect/session state.
- [x] T-022: Implement session expiry/failure/abandonment mutation that voids pending reservations and records terminal status without creating deals.
- [x] T-023: Add Convex tests for checkout-start validation, idempotent replay, reservation creation, reservation cleanup on provider failure, and expiry/void behavior.

## Phase 4: Verified Stripe Success
- [x] T-030: Extend Stripe webhook event typing and persistence branch for `checkout.session.completed` while preserving signature verification and existing reversal handling.
- [x] T-031: Implement success processing that resolves FairLend session by Stripe checkout session id, handles duplicate/unknown/out-of-order events, enforces expiry, and records refund-needed/refunded late-success state.
- [x] T-032: Implement idempotent success-to-deal creation that writes deal participant/fraction/lawyer/reservation/payment metadata, grants buyer/seller/lawyer access, links reservation, and emits `DEAL_LOCKED` through the Transition Engine.
- [x] T-033: Add webhook/session tests for valid success, late success no-deal, unknown session, duplicate events, and existing reversal regression.

## Phase 5: Effects Compatibility
- [x] T-040: Update `reserveShares` effect to confirm or no-op when a checkout-created reservation is already linked to the deal.
- [x] T-041: Update `collectLockingFee` to skip or reconcile when Stripe checkout already collected the CAD 250 lock fee.
- [x] T-042: Add or update deal/effect tests proving no duplicate reservation, fee transfer, package, access grant, or deal is created by retries.

## Phase 6: Marketplace UI
- [x] T-050: Extend marketplace listing detail snapshot/model types with checkout readiness, provider/config state, and lawyer options required by the production CTA.
- [x] T-051: Wire `MarketplaceListingDetailPage` and `ListingDetailPage` to call checkout start and redirect to Stripe, with disabled/error states for unauthenticated, provider missing, no available fractions, invalid selection, no lawyer, and backend rejection.
- [x] T-052: Update listing detail component tests for enabled checkout, redirect, disabled provider/config state, invalid selection, and backend errors.

## Phase 7: Validation And Audit
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check` before manual lint/format fixes.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted tests for checkout, Stripe webhook, listing detail, deal effects, and locking-fee behavior.
- [x] T-904: Run `bun run test`.
  - Blocked: full suite fails in unrelated existing areas recorded in `audit.md`; ENG-341 targeted tests pass.
- [x] T-905: Run `bun run test:e2e` or record why no e2e flow was introduced.
  - Not run: no mocked browser Stripe return flow was introduced; Convex webhook/session and component tests cover this change.
- [x] T-906: Run `bun run review`.
- [x] T-907: Run GitNexus detect changes before finalizing.
  - Local CLI has no `detect_changes`; used `npx gitnexus status`, `git diff --stat`, and pre-edit impact checks as fallback.
- [x] T-910: Run `$linear-pr-spec-audit` for ENG-341 against the current branch diff and persist the verdict in `audit.md`.
- [x] T-920: Resolve audit findings or record explicit blockers, then rerun artifact final validation.
