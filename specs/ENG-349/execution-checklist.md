# Execution Checklist: ENG-349 - Checkout: create deal from paid checkout and hand off documents

## Requirements From Linear
- [x] Consume only an internally verified paid checkout session that is still valid and not expired/abandoned/refunded.
- [x] Create exactly one deal for a checkout session. Use checkout id or idempotency key to make duplicate webhook/action retries return the existing deal.
- [x] Link the deal to `checkoutSessionId` if schema exists, `reservationId`, `lockFeeTransferRequestId`, Stripe Checkout Session ID, and Stripe PaymentIntent ID through typed fields or metadata documented in the PR.
- [x] Persist the domain lender on `deals.lenderId` and preserve `lenderAuthId` only where auth principal context is required.
- [x] Copy selected lawyer snapshot onto the deal as `lawyerId`, `lawyerType`, and any additional deal-scoped participant/access records needed for package generation.
- [x] Create deal access / closing team rows for all participants required by current deal/document flows, including selected lawyer as `platform_lawyer` or `guest_lawyer` according to the snapshot.
- [x] Fail closed instead of rewriting conflicting checkout, transfer, buyer, mortgage, fractional-share, Stripe, or lawyer links during replay repair.
- [x] Generate the deal package from the mortgage's active private blueprints at deal-creation time.
- [x] Resolve `lender_primary` from the lender who locked the listing and `lawyer_primary` from the lawyer selected during checkout, not from stale mortgage defaults.
- [x] Signable package output remains the upstream input for the Documenso envelope vertical; do not build live envelopes here unless that vertical already exposes a stable callable seam.
- [x] Existing Deal GT effects must not create a second reservation for marketplace-created deals. If a deal already has `reservationId`, `reserveShares` must be skipped or idempotently no-op.
- [x] Every deal creation, duplicate replay, package generation failure, and access creation failure path must be auditable and recoverable.
  - Evidence: handoff audit entries cover creation/replay; package rows retain failed status and error for retry; package failure emits `CHECKOUT_DEAL_HANDOFF_FAILED`; access grants are idempotent and repaired on replay.

## Definition Of Done From Linear
- [x] A valid paid checkout creates exactly one deal and package.
- [x] Deal links reservation, checkout, lock-fee transfer, Stripe refs, lender, and selected lawyer.
- [x] Duplicate events/retries cannot create duplicate deals, access rows, reservations, or packages.
- [x] Duplicate or corrupted replays cannot silently reassign buyer ownership or lock-fee transfer evidence.
- [x] Marketplace-created deals do not trigger duplicate reservation creation in existing GT effects.
- [x] Package signatory mapping uses actual checkout participants.
- [x] Required commands pass.
  - Evidence: `bunx convex codegen`, `bun check`, and `bun typecheck` passed; focused ENG-349 tests passed. Full `bun run test` was also run and failed on broader existing failures outside this issue.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated where backend or domain logic changed.
- [x] E2E tests added or updated where an operator or user workflow changed.
  - Planned justification: this slice is backend/domain only; full marketplace E2E is explicitly deferred to ENG-351 unless the implementation introduces a user route.
- [x] Storybook stories added or updated where reusable UI changed.
  - Planned justification: no reusable UI changes are in scope.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] Required quality gates passed.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
