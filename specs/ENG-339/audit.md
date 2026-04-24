# Spec Audit: ENG-339 - Checkout: define governed checkout session contract

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff in `/Users/connor/.codex/worktrees/364d/fairlendapp`
- Last run: 2026-04-24T18:34:37Z
- Verdict: ready

## Findings
- none

## Unresolved items
- none

## Next action
- No ENG-339 follow-up required. Full `bun run test` still has unrelated baseline failures documented in `specs/ENG-339/status.md`.

## Coverage Summary
- SATISFIED: 17
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 0
- OUT_OF_SCOPE: 5

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | schema | Add `checkoutSessions` with required identifiers, reservation, ledger accounts, lawyer snapshot, Stripe refs, deal/transfer refs, timestamps, idempotency, provider event, and failure fields. | `convex/schema.ts` | Table fields are present with typed Convex validators. |
| SATISFIED | schema | Add indexes `by_listing_status`, `by_lender`, `by_reservation`, `by_stripe_checkout_session`, `by_status_expires_at`, and `by_idempotency`. | `convex/schema.ts`, `convex/checkout/__tests__/schema.test.ts` | Schema test asserts exact index names and fields. |
| SATISFIED | lifecycle | Export typed checkout statuses and terminal/active helpers. | `convex/checkout/status.ts`, `convex/checkout/__tests__/status.test.ts` | Includes all ENG-339 status literals and helper tests. |
| SATISFIED | lifecycle | Define legal transitions for preparing, hosted/open, retryable, and terminal behavior. | `convex/checkout/status.ts`, `convex/checkout/__tests__/status.test.ts` | `expired -> refunded_late_success` is terminal-to-terminal and does not reopen active checkout. |
| SATISFIED | validation | Add selected-lawyer snapshot validators for platform and guest lawyer selections. | `convex/checkout/validators.ts`, `convex/checkout/__tests__/validators.test.ts` | Platform lawyers may carry `lawyerId`; guest lawyers cannot. |
| SATISFIED | integration contract | Add Stripe metadata builder/parser containing checkout, reservation, listing, mortgage, portal, lender, lender auth, lawyer, fraction, lock fee, and idempotency fields. | `convex/checkout/metadata.ts`, `convex/checkout/__tests__/metadata.test.ts` | Parser validates required string metadata and server-owned lock fee values. |
| SATISFIED | provider contract | Extend transfer provider contract with `stripe`. | `convex/payments/transfers/types.ts`, `convex/payments/transfers/validators.ts` | Type-level constants and Convex validator both accept `stripe`. |
| SATISFIED | provider contract | Keep payout bridge from accidentally accepting checkout-only `stripe` provider. | `convex/payments/payout/transferOwnedFlow.ts` | Payout provider arg excludes `stripe`, preserving existing bridge contract. |
| SATISFIED | lock fee | Keep lock fee constants server-owned at `25000` cents and `CAD`. | `convex/checkout/validators.ts`, `convex/checkout/metadata.ts`, tests | Schema uses literal validators; metadata parser rejects tampering. |
| SATISFIED | reservation ownership | Keep `ledger_reservations` as the lock source of truth. | `convex/schema.ts`, `convex/checkout/__tests__/schema.test.ts` | `checkoutSessions.reservationId` points to `ledger_reservations`; no `fractionLocks` table added. |
| SATISFIED | negative contract | Do not add listing availability counters. | `convex/checkout/__tests__/schema.test.ts` | Test asserts checkout schema has no availability lock counters. |
| SATISFIED | endpoint contract | Do not expose raw Convex pseudo-endpoints. | branch diff | ENG-339 adds pure modules/schema/tests only; no exported Convex functions. |
| SATISFIED | type quality | Avoid avoidable `any`. | branch diff | New runtime parsers use `unknown`; no new production `any` in checkout contract modules. |
| SATISFIED | codegen | Generated Convex API includes checkout module/table changes. | `bunx convex codegen`, `convex/_generated/api.d.ts` | Command passed. |
| SATISFIED | tests | Add unit/schema/provider tests for status, transition, lawyer validation, metadata, provider code, and schema/index contract. | checkout and transfer test files | Targeted suite passed: 7 files, 110 tests. |
| SATISFIED | validation | Run required quality gates. | local command output | `bun check`, `bun typecheck`, and `bunx convex codegen` passed. |
| SATISFIED | validation | Run full suite or document unrelated failures. | `bun run test`, `specs/ENG-339/status.md` | Full suite failed on pre-existing unrelated fixtures/auth guard tests; scoped ENG-339 tests passed. |
| OUT_OF_SCOPE | Stripe runtime | Do not call Stripe or create hosted sessions in ENG-339. | branch diff | No provider calls or actions added. |
| OUT_OF_SCOPE | reservation runtime | Do not create or expire reservations in ENG-339. | branch diff | Contract-only schema/modules/tests. |
| OUT_OF_SCOPE | deal runtime | Do not create deals in ENG-339. | branch diff | No deal transition code added. |
| OUT_OF_SCOPE | webhook/runtime reconciliation | Do not implement checkout webhooks, late refunds, or expiry jobs in ENG-339. | branch diff | Only metadata/status contracts added. |
| OUT_OF_SCOPE | UI | Do not build checkout UI in ENG-339. | branch diff | No frontend route/component changes. |
