# Spec Audit: ENG-349 - Checkout: create deal from paid checkout and hand off documents

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff against base
- Last run: 2026-04-25T22:01:00Z
- Verdict: ready

## Findings
- No `MISSING` or `CONTRADICTED` ENG-349 requirements found in the branch diff.
- Parallel review aggregation completed with `$linear-pr-spec-audit`, `$pr-review-toolkit`, `$caveman-review`, `$gitnexus-pr-review`, and `$superpowers:requesting-code-review`.
- All second-round findings were addressed:
  - lock-fee transfer rows are validated and conflicting `transfer.dealId` links fail closed instead of being overwritten;
  - existing-deal replay repairs missing links but rejects conflicting buyer/payment/domain links;
  - duplicate package generation is idempotent and the scheduled transition effect now works as a fallback when no package exists;
  - package failures are journaled on the checkout handoff path;
  - replay of a partially recovered `initiated` deal runs `DEAL_LOCKED`;
  - guest lawyer email access is normalized and covered by a mixed-case test;
  - Stripe webhook success and duplicate delivery exercise the real webhook path.
- Validation caveat: `bun run test` was executed and failed on broader baseline issues outside this checkout handoff slice, including listing fixture schema drift around `marketplacePropertyType`, React dispatcher failures in existing frontend tests, auth architecture guard offenders, AMPS demo lifecycle failures, and one transfer auth fixture failure. Focused ENG-349 suites pass.

## Unresolved items
- none

## Requirement Coverage
- Internally verified paid checkout: satisfied by `checkoutSessions.status === "completed"` plus required lock-fee and Stripe checkout session link checks in `convex/checkout/dealHandoff.ts`.
- Exactly one deal per checkout: satisfied by `checkoutSession.dealId` reuse plus `deals.by_checkout_session` lookup and replay tests.
- Link checkout, reservation, transfer, Stripe refs, lender, and lawyer: satisfied by new typed deal fields and handoff persistence.
- Lender and selected lawyer access: satisfied by idempotent `grantDealAccess` calls and platform/guest lawyer tests.
- Seller-side access: satisfied by an idempotent lender-role grant for the seller ledger principal currently stored on `deal.sellerId`.
- Package generation handoff and retry reuse: satisfied by direct package generation from the handoff action and tests covering failed package retry without duplicate deal/package rows.
- Checkout participant signatories: satisfied by selected-lawyer-aware `buildParticipantSnapshot` behavior and guest lawyer signatory test.
- No duplicate marketplace reservation: satisfied by `reserveShares` existing `reservationId` guard and focused effect test.
- Webhook handoff: satisfied by Stripe checkout success reconciliation invoking `createDealFromPaidCheckoutInternal`.

## Validation Evidence
- `bun run test convex/checkout/__tests__/dealHandoff.test.ts convex/engine/effects/__tests__/dealLockingFee.test.ts`: pass, 26 tests.
- `bunx convex codegen`: pass.
- `bun check`: pass, with warning-level pre-existing complexity/style diagnostics.
- `bun typecheck`: pass.
- `bun run test`: failed with 30 broader failures outside the ENG-349 touched surface; not treated as a spec-blocking ENG-349 audit finding. Current failing buckets include existing auth architecture guard offenders, listing fixture `marketplacePropertyType` schema drift, React dispatcher `useMemo` failures, single paginate guard, AMPS lifecycle, and one transfer auth fixture.
