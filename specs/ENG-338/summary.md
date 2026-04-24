# Summary: ENG-338 - Deal closing: normalize participant, access, and fraction contracts

- Source issue: https://linear.app/fairlend/issue/ENG-338/deal-closing-normalize-participant-access-and-fraction-contracts
- Primary plan: https://www.notion.so/34cfc1b440248146ad2cde40d49a8828
- Supporting docs:
- https://www.notion.so/321fc1b440248127a3bef2ea0371aaf6
- https://www.notion.so/322fc1b44024811cbccad22752327a08
- https://www.notion.so/313fc1b440248189a811ee4c5e551798

## Scope
- Define a shared server-side deal participant/access/fraction projection contract for buyer, seller, lawyer, and admin persona semantics.
- Keep `dealAccess.role` storage roles as `lender`, `borrower`, `platform_lawyer`, and `guest_lawyer`; map them explicitly to portal personas in projection code and tests.
- Update `getPortalDealDetail`, document package read-model code where appropriate, and existing lender/admin UI surfaces so downstream consumers receive `fractionalShareUnits` and `fractionalShareDisplayPercent`.
- Add focused Convex and component tests for active access, revoked access denial, unresolved participants, lawyer states, idempotent grants, role mapping, and 10,000-based fraction display.

## Constraints
- WorkOS AuthKit remains the identity source of truth.
- Staff-global reads must use FairLend staff admin semantics through `requireFairLendAdmin` / `adminQuery`, not `admin:access` alone.
- Participant and lawyer reads must enforce server-side authorization through shared Convex helpers.
- The Transition Engine remains the only code path that mutates deal status fields.
- `dealAccess` rows are audit-relevant and must remain soft-revoked, not hard-deleted.
- Exported Convex functions must use fluent-convex builders with explicit `.public()` or `.internal()` visibility.
- No `any` unless isolated and justified.
- This issue must not build buyer, seller, lawyer, checkout, Stripe, Documenso, or admin-console feature UI beyond targeted contract consumer updates.

## Open questions
- none
