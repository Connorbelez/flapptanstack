# Spec Audit: ENG-340 - Checkout: implement two-phase hosted Stripe start

- Audit skill: `$linear-pr-spec-audit`
- Review target: current local branch diff for ENG-340 in `/Users/connor/.codex/worktrees/093a/fairlendapp`
- Last run: 2026-04-24T20:38:10Z
- Verdict: ready

## Findings
- none

## Coverage Summary
- SATISFIED: 18
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 0
- OUT_OF_SCOPE: 4

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | capability | Export public `startMarketplaceCheckout` returning `{ ok: true; checkoutSessionId; stripeCheckoutUrl; expiresAt }` or typed failures. | `convex/checkout/actions.ts`, `convex/checkout/types.ts` | Public fluent action has explicit input/result validators. |
| SATISFIED | auth/RBAC | Require authenticated lender with `listing:invest`. | `convex/checkout/actions.ts` | Uses `authedAction.use(requirePermissionAction("listing:invest"))`. |
| SATISFIED | validation | Validate listing, portal visibility, production mortgage source, requested fractions, lender profile, and selected lawyer before lock creation. | `convex/checkout/mutations.ts`, `convex/checkout/__tests__/start.test.ts` | Rejections are tested before any reservation/checkout insert for demo listings and malformed lawyer snapshots. |
| SATISFIED | validation | Reject demo listings and hidden/filtered listings before lock creation. | `convex/checkout/mutations.ts`, `convex/checkout/__tests__/start.test.ts` | Demo listing path returns `demo_listing_not_supported`; visibility uses portal lender constraints and marketplace filters. |
| SATISFIED | ledger | Resolve seller and buyer ledger accounts from canonical ledger/account ownership data, not MIC regexes or WorkOS principal ids. | `convex/checkout/mutations.ts` | Seller is chosen from POSITION accounts for the mortgage with sufficient available balance; buyer ledger id is derived from the lender record id. |
| SATISFIED | atomicity | Create `ledger_reservations` and `checkoutSessions` in one internal mutation. | `convex/checkout/mutations.ts`, `convex/ledger/mutations.ts` | `prepareMarketplaceCheckout` calls extracted `reserveSharesHandler` and inserts checkout session in the same Convex mutation. |
| SATISFIED | lifecycle | Initial checkout session status is `preparing_provider_session` with five-minute expiry. | `convex/checkout/types.ts`, `convex/checkout/mutations.ts` | `CHECKOUT_SESSION_TTL_MS` is five minutes and inserted session status matches the contract. |
| SATISFIED | provider seam | Use a mockable provider abstraction for hosted Stripe Checkout. | `convex/checkout/stripe.ts`, `convex/checkout/__tests__/stripe.test.ts` | `CheckoutProvider` supports create and expire operations; tests cover params, provider failures, and malformed responses. |
| SATISFIED | Stripe | Create hosted Checkout for CAD 250 lock fee. | `convex/checkout/stripe.ts` | `line_items[0][price_data][unit_amount]` uses `25_000` and currency `cad`. |
| SATISFIED | metadata | Include checkout, reservation, listing, mortgage, portal, lender, requested fractions, lawyer, fee, and idempotency metadata. | `convex/checkout/metadata.ts`, `convex/checkout/stripe.ts` | Metadata is mirrored onto checkout session and payment intent params. |
| SATISFIED | idempotency | Stripe idempotency key is derived from internal checkout session id. | `convex/checkout/types.ts`, `convex/checkout/mutations.ts`, `convex/checkout/actions.ts` | Key format is `marketplace-checkout:<checkoutSessionId>`. |
| SATISFIED | success ordering | Attach Stripe ids and transition to `hosted_checkout_open` before returning hosted URL. | `convex/checkout/actions.ts`, `convex/checkout/mutations.ts`, `convex/checkout/__tests__/start.test.ts` | Action only returns URL after `attachProviderSession` succeeds. |
| SATISFIED | compensation | Provider creation/config failure transitions to `provider_start_failed`, voids reservation, and records `failureReason`. | `convex/checkout/actions.ts`, `convex/checkout/mutations.ts`, `convex/checkout/__tests__/start.test.ts` | Missing Stripe secret and direct compensation paths are tested. |
| SATISFIED | compensation | Provider attach failure attempts provider expiry when a Stripe session id exists, then compensates the local lock. | `convex/checkout/actions.ts`, `convex/checkout/stripe.ts` | Expire call is made in the attach failure catch path before `markProviderStartFailed`. |
| SATISFIED | duplicate start | Duplicate active starts do not create duplicate reservations and reuse the same checkout session/provider idempotency key. | `convex/checkout/mutations.ts`, `convex/checkout/__tests__/start.test.ts` | Duplicate replay is scoped to same lender/listing/portal/fractions/lawyer and active unexpired status. |
| SATISFIED | concurrency | Race/no-oversell behavior prevents a second dangling reservation when final fractions are requested. | `convex/checkout/__tests__/start.test.ts`, `convex/ledger/mutations.ts` | Parallel lender test leaves exactly one reservation. |
| SATISFIED | tests | Unit and Convex tests cover provider, metadata, validators, prepare/start, compensation, idempotency, and race behavior. | `convex/checkout/__tests__`, `convex/ledger/__tests__/reservation.test.ts` | Focused run passed 55 tests. |
| SATISFIED | quality gates | Run required repo gates. | command output recorded in `specs/ENG-340/status.md` | `bunx convex codegen`, `bun check`, and `bun typecheck` passed. |
| OUT_OF_SCOPE | webhooks | Do not implement Stripe webhook handling in ENG-340. | changed files | No webhook code added. |
| OUT_OF_SCOPE | deal lifecycle | Do not commit/settle reservations or create deals in ENG-340. | changed files | Only reserve, checkout start, and compensation paths were added. |
| OUT_OF_SCOPE | expiry/refund | Do not implement checkout expiry sweeper or late-success refunding in ENG-340. | changed files | No cron/refund code added. |
| OUT_OF_SCOPE | UI | Do not implement frontend checkout UX in ENG-340. | changed files | No UI files changed for checkout. |

## Validation Notes
- `bunx convex codegen`: passed.
- `bun check`: passed; repo still reports 93 pre-existing warnings.
- `bun typecheck`: passed.
- Focused test command passed 55 tests: `ALLOW_TEST_AUTH_ENDPOINTS=true DISABLE_GT_HASHCHAIN=true DISABLE_CASH_LEDGER_HASHCHAIN=true bunx vitest run convex/checkout/__tests__/start.test.ts convex/checkout/__tests__/types.test.ts convex/checkout/__tests__/stripe.test.ts convex/checkout/__tests__/metadata.test.ts convex/checkout/__tests__/validators.test.ts convex/ledger/__tests__/reservation.test.ts`.
- Full `bun run test` was attempted and failed on unrelated existing suites, primarily listing fixture schema drift, React hook test environment failures, existing architecture guard offenders, a single-paginate guard, and a payments reconciliation auth fixture.

## Unresolved items
- none for ENG-340 spec compliance

## Next action
- Final artifact validation and GitNexus affected-scope check.
