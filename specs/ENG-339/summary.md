# Summary: ENG-339 - Checkout: define governed checkout session contract

- Source issue: https://linear.app/fairlend/issue/ENG-339/checkout-define-governed-checkout-session-contract
- Primary plan: https://www.notion.so/34cfc1b4402481269961c605566b7961
- Supporting docs:
  - https://www.notion.so/329fc1b440248106b45ef400bfe497db
  - https://www.notion.so/30ffc1b440248079819bf55c7bcfbe93
  - https://www.notion.so/315fc1b44024811fbee6ecc7b00a378f

## Scope
- Add the `checkoutSessions` Convex schema table with the exact fields and indexes required by ENG-339.
- Add typed checkout status constants, terminal helpers, and transition legality for the governed checkout lifecycle.
- Add selected-lawyer snapshot validators for platform and guest lawyer selections.
- Add Stripe metadata build/parse contract for downstream hosted checkout and webhook reconciliation work.
- Extend the canonical transfer provider contract so `locking_fee_collection` can use a Stripe-compatible provider literal.
- Add tests for checkout statuses, transitions, selected-lawyer validation, Stripe metadata, provider code support, and representative schema/index contracts.
- Run Convex codegen and required repo validation commands.

## Constraints
- This slice is contract-only: do not create reservations, call Stripe, handle webhooks, create deals, expire sessions, refund payments, or build UI.
- `ledger_reservations` remains the temporary lock source of truth; do not add `fractionLocks` or mutable listing availability counters.
- Hosted Stripe Checkout is the payment surface for downstream work; embedded Stripe Elements and raw PaymentIntent-first UX are superseded for Goal 4.
- Lock fee constants are server-owned: `25000` cents and `CAD`.
- Checkout TTL is 5 minutes from `startedAt`; older 15-minute TTL references are superseded by Goal 4.
- Domain `lenderId` and WorkOS/auth `lenderAuthId` must remain separate.
- New exported Convex endpoints are not expected. If any are added, they must use fluent builders with explicit `.public()` or `.internal()`.
- Avoid `any`; isolate existing schema `v.any()` only where current machine snapshot patterns require it.

## Open questions
- none
