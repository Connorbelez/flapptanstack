# Execution Checklist: ENG-339 - Checkout: define governed checkout session contract

## Requirements From Linear
- [x] Add `checkoutSessions` with the exact fields and indexes listed in the Linear dependency contract unless a stricter typed equivalent is documented.
- [x] Export typed status constants and terminal-state helpers for all checkout lifecycle states.
- [x] Add a typed selected-lawyer snapshot validator where `platform_lawyer` may carry a `lawyerId` and guest lawyers carry immutable name/email/optional firm.
- [x] Add a Stripe metadata builder/parser contract containing checkout, reservation, listing, mortgage, portal, lender, lender auth, selected lawyer, requested fractions, lock fee, and idempotency fields.
- [x] Extend the transfer provider contract so `locking_fee_collection` can use a Stripe-compatible provider code, preferring `stripe`.
- [x] Define checkout transition legality: preparing -> hosted/open or provider_start_failed; hosted/open -> payment_failed_retryable, completed, expired, abandoned, refunded_late_success; retryable -> hosted/open, expired, abandoned; terminal states cannot leave terminal.
- [x] Keep lock fee constants server-owned: `25000` cents and `CAD`.
- [x] Keep `ledger_reservations` as the lock source of truth; do not add `fractionLocks` or listing availability counters.
- [x] Do not expose raw helper functions as pseudo-endpoints; any exported Convex functions must use fluent builders and explicit `.public()` or `.internal()` visibility.
- [x] Do not use `any` unless there is no viable typed alternative; isolate and explain unavoidable schema `v.any()`.

## Definition Of Done From Linear
- [x] `checkoutSessions` exists with required fields and indexes.
- [x] Checkout status/type modules exist and are typed without avoidable `any`.
- [x] Stripe metadata contract is explicit and tested.
- [x] Transfer provider contract accepts the chosen Stripe provider literal.
- [x] No reservation, Stripe, deal, expiry, or UI flow has been partially implemented in this foundational slice.
- [x] Generated Convex API is up to date.
- [x] Required commands pass.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated for checkout status helpers, transition legality, selected-lawyer validation, Stripe metadata, and provider code support.
- [x] Backend/Convex tests added or updated where schema/index contracts can be verified without implementing runtime checkout flows.
- [x] E2E tests are not applicable because ENG-339 has no operator or user workflow surface.
- [x] Storybook stories are not applicable because ENG-339 has no reusable UI component or screen surface.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] `bunx convex codegen` passed.
- [x] `bun check` passed.
- [x] `bun typecheck` passed.
- [x] Targeted tests for checkout and transfer provider contracts passed.
- [x] Full `bun run test` passed or any failure is documented as unrelated.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
