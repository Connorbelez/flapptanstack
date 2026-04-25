# Tasks: ENG-344 - Checkout: reconcile Stripe success, failure, and late success

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Populate execution artifacts from Linear ENG-344, the Notion implementation plan, and directly linked Goal 4 docs.
- [x] T-002: Run ready-to-edit artifact validation.
- [x] T-003: Run GitNexus impact analysis for `stripeWebhook`, `persistVerifiedTransferWebhook`, `markTransferWebhookFailed`, `createTransferRequestRecord`, `PROVIDER_CODES`, `TRANSFER_TYPE_TO_OBLIGATION_TYPE`, and `postLockingFeeReceived` before code edits.

## Phase 2: Implementation
- [x] T-010: Extend `convex/payments/webhooks/stripe.ts` with hosted checkout success/failure classification that does not regress reversal classification.
- [x] T-011: Add strict checkout event payload extraction for Checkout Session ID, PaymentIntent ID, status, metadata, and provider event IDs.
- [x] T-020: Create `convex/checkout/reconciliation.ts` with idempotent checkout lookup, metadata conflict checks, active/expired decision logic, and safe replay handling.
- [x] T-021: Add active success handling that creates or reuses one `locking_fee_collection` transfer through `createTransferRequestRecord`.
- [x] T-022: Patch checkout sessions with Stripe refs, `lockFeeTransferRequestId`, `completedAt`/`resolvedAt`, `lastProviderEventId`, and `completed` status only when internal state permits it.
- [x] T-023: Add retryable payment failure handling that transitions active sessions to `payment_failed_retryable` without voiding reservations or extending TTL.
- [x] T-030: Create `convex/checkout/refunds.ts` with late-success refund intent/completion/failure persistence and an explicit retryable helper surface.
- [x] T-031: Ensure late success after `expired`, `abandoned`, or terminal-invalid state records no deal-ready success and no confirmed transfer.
- [x] T-040: Route Stripe checkout events from `stripeWebhook` through reconciliation after raw event persistence and mark persisted events processed/failed with operation-visible errors.
- [x] T-041: Preserve the existing unsupported reversal bridge and add regression coverage for reversal behavior.
- [x] T-050: Add or update unit tests for event classification, metadata conflicts, transfer payload construction, and refund decisions.
- [x] T-051: Add or update Convex tests for active success, duplicate webhook replay, payment failure before expiry, late success refund, unknown checkout, and tampered metadata.

## Phase 9: Audit
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted Stripe webhook / checkout reconciliation / transfer tests.
- [x] T-904: Run broader `bun run test` if shared payment modules were touched broadly.
  - Not run: shared payment state machine/transfer implementation was consumed through existing APIs, not changed broadly; focused Convex tests exercise checkout reconciliation, transfer creation/confirmation, and webhook classification.
- [x] T-910: Run `$linear-pr-spec-audit` for ENG-344 against the branch diff.
- [x] T-920: Resolve audit findings or record blockers and rerun audit if needed.
  - Resolved audit-discovered gap: `payment_intent.payment_failed` payloads no longer treat the PaymentIntent ID as a Checkout Session ID; added payload and backend reconciliation coverage.
- [x] T-930: Run final artifact validation with audit and all tasks/checklist closed.
