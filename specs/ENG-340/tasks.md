# Tasks: ENG-340 - Checkout: implement two-phase hosted Stripe start

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Gather Linear issue, comments, relations, and implementation plan.
- [x] T-002: Scaffold execution artifacts and chunk directories.
- [x] T-003: Run GitNexus indexing and initial impact checks for planned existing touchpoints.
- [x] T-004: Validate artifacts at ready-to-edit stage.

## Phase 2: Provider Contract
- [x] T-010: Add checkout start input/result types and validators in `convex/checkout`.
- [x] T-011: Add Stripe Checkout provider abstraction and default Stripe implementation in `convex/checkout/stripe.ts`.
- [x] T-012: Add test double hooks for deterministic provider success, failure, malformed response, and provider expiry attempts.

## Phase 3: Internal Mutations
- [x] T-020: Implement canonical seller and buyer account resolution for checkout preparation.
- [x] T-021: Implement internal prepare mutation that validates listing/portal/lender/lawyer/fractions and creates reservation plus checkout session in one transaction.
- [x] T-022: Implement provider attach mutation that validates transitions and links Stripe identifiers.
- [x] T-023: Implement provider-start-failed compensation mutation that voids reservations and records failure/audit evidence.

## Phase 4: Action Orchestration
- [x] T-030: Implement `startMarketplaceCheckout` action with auth/RBAC, prepare mutation call, Stripe hosted session creation, provider attach, and typed errors.
- [x] T-031: Implement duplicate active-session replay behavior without duplicate reservations or Stripe sessions.
- [x] T-032: Attempt provider session expiry after attach failure when a Stripe session id exists.

## Phase 5: Tests
- [x] T-040: Add unit tests for fraction/lawyer/result/metadata/provider behavior.
- [x] T-041: Add Convex tests for successful prepare/start, no partial links, compensation, auth/portal/demo/listing rejections, and idempotency.
- [x] T-042: Add race/no-oversell test coverage for final available fractions.
- [x] T-043: Document why E2E and Storybook are not applicable for this backend-only slice.

## Phase 9: Validation
- [x] T-900: Run final quality gates.
- [x] T-910: Run `$linear-pr-spec-audit`.
- [x] T-920: Resolve audit findings or record blockers.
