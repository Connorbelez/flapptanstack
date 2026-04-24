# Summary: ENG-341 - Deal closing: create deals from verified listing-lock checkout

- Source issue: https://linear.app/fairlend/issue/ENG-341/deal-closing-create-deals-from-verified-listing-lock-checkout
- Primary plan: https://www.notion.so/34cfc1b4402481668f61c7d30945516b
- Supporting docs:
- https://www.notion.so/34cfc1b440248146ad2cde40d49a8828
- https://www.notion.so/313fc1b440248189a811ee4c5e551798
- https://www.notion.so/317fc1b4402481a0964ded0ec547a9de
- https://www.notion.so/321fc1b440248127a3bef2ea0371aaf6
- https://www.notion.so/325fc1b440248138ac81fc289e953903

## Scope
- Add durable listing-lock checkout session state with five-minute FairLend expiry, Stripe checkout identifiers, participant/fraction/lawyer context, reservation linkage, status history, optional deal linkage, and audit-queryable timestamps.
- Implement authenticated checkout start for published marketplace listings that re-reads listing, mortgage, availability, buyer/seller, lawyer selection, and fraction units server-side before creating a temporary ledger reservation or hosted Stripe Checkout session.
- Extend verified Stripe webhook handling so checkout success resolves the FairLend session, enforces idempotency and expiry, creates exactly one deal, grants portal-ready participant access, links the reservation, stores Stripe payment metadata, and emits `DEAL_LOCKED` through the Transition Engine.
- Add expiry, failed, abandoned, late-success refund-needed/refunded paths that void temporary reservations and never create deals from stale sessions.
- Make `DEAL_LOCKED` effects compatible with checkout-created reservations and externally collected Stripe lock fees, avoiding duplicate reservations, fee transfers, package creation, or access grants.
- Wire the production listing detail CTA to start checkout and redirect only when backend readiness/provider config and valid user selections allow it.
- Add focused Convex/webhook/component tests and run the required repository validation gates.

## Constraints
- WorkOS AuthKit is the identity source of truth; checkout start must use authenticated Convex viewer context and server-side authorization, not client-supplied party data.
- ENG-338 participant/access/fraction projection exists in this worktree and must remain the downstream contract; storage roles stay `lender`, `borrower`, `platform_lawyer`, and `guest_lawyer`.
- Deals must not be created before verified Stripe payment success inside the FairLend session window.
- `deals.status` must only change through the Transition Engine; verified checkout may insert an `initiated` deal, then must emit `DEAL_LOCKED`.
- Stripe signature verification and raw provider event persistence must remain intact before provider acknowledgement.
- Ledger reservation primitives are the source for temporary reservation state; do not create a parallel share-lock ledger.
- Exported Convex queries, mutations, and actions must use fluent-convex builders with explicit `.public()` or `.internal()` unless they are Convex HTTP actions.
- Run `bun check` before manual formatting/lint fixes.

## Open questions
- No planning blocker. Stripe provider calls should use the least invasive custom Stripe boundary after inspecting current `@convex-dev/stripe` usage; the current repo has the dependency but webhook handling is custom.
