# Tasks: ENG-339 - Checkout: define governed checkout session contract

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Gather Linear issue, attachments, comments, and linked Notion plan context.
- [x] T-002: Scaffold execution artifacts and define chunk boundaries.
- [x] T-003: Run GitNexus indexing and impact checks for planned shared-symbol edits.

## Phase 2: Checkout Contract Modules
- [x] T-010: Create `convex/checkout/status.ts` with checkout status constants, terminal helpers, and transition legality.
- [x] T-011: Create `convex/checkout/validators.ts` with status and selected-lawyer snapshot validators.
- [x] T-012: Create `convex/checkout/metadata.ts` with Stripe metadata constants, builder, and parser.

## Phase 3: Schema And Transfer Provider Contract
- [x] T-020: Add `checkoutSessions` to `convex/schema.ts` with required fields and indexes.
- [x] T-021: Extend `PROVIDER_CODES` and `ProviderCode` in `convex/payments/transfers/types.ts` with `stripe`.
- [x] T-022: Extend `providerCodeValidator` in `convex/payments/transfers/validators.ts` with `stripe`.
- [x] T-023: Run `bunx convex codegen` and verify generated Convex API includes `checkoutSessions`.

## Phase 4: Tests
- [x] T-030: Add checkout status and transition legality tests.
- [x] T-031: Add selected-lawyer validator tests.
- [x] T-032: Add Stripe metadata builder/parser tests.
- [x] T-033: Add transfer provider-code tests covering `locking_fee_collection` with `stripe`.
- [x] T-034: Add representative Convex schema/index coverage for `checkoutSessions` if the local test harness supports schema queries cleanly.

## Phase 5: Validation
- [x] T-900: Run targeted checkout and transfer tests.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run `bun run test` or document unrelated failures.

## Phase 9: Audit
- [x] T-910: Run `$linear-pr-spec-audit` against ENG-339 and current branch diff.
- [x] T-920: Resolve audit findings or record blockers.
- [x] T-930: Run final execution artifact validation.
