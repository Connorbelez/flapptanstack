# Tasks: ENG-349 - Checkout: create deal from paid checkout and hand off documents

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Populate execution artifacts and validate `ready-to-edit`.
- [x] T-002: Run GitNexus impact analysis for existing symbols expected to change.

## Phase 2: Tests And Contract
- [x] T-010: Add failing Convex tests for paid checkout handoff eligibility and rejection of invalid checkout statuses.
- [x] T-011: Add failing Convex tests for idempotent duplicate handoff returning the existing deal/package.
- [x] T-012: Add failing Convex tests for platform and guest lawyer access plus lender access.
- [x] T-013: Add failing Convex tests for package generation failure visibility and retry reuse.
- [x] T-014: Add failing effect test proving `reserveShares` skips when a deal already has `reservationId`.

## Phase 3: Handoff Domain
- [x] T-020: Add typed deal linkage fields and indexes needed for checkout idempotency.
- [x] T-021: Implement `convex/checkout/dealHandoff.ts` with internal/public callable surfaces using fluent-convex visibility.
- [x] T-022: Implement completed-checkout eligibility, existing-deal lookup, and idempotent checkout `dealId` patching.
- [x] T-023: Create deal rows with reservation, transfer, Stripe refs, lender, selected lawyer, and governed initial state.
- [x] T-024: Grant lender and selected lawyer deal access idempotently.

## Phase 4: Reservation And Package Handoff
- [x] T-030: Generate or repair the mortgage-linked deal package from the handoff path.
- [x] T-031: Update document package participant resolution so `lawyer_primary` comes from deal-scoped selected lawyer data.
- [x] T-032: Record package-generation failure on the checkout/deal handoff path without duplicating deals on retry.
- [x] T-033: Guard `convex/engine/effects/dealClosing.ts` reservation creation when a deal already has `reservationId`.

## Phase 5: Validation And Audit
- [x] T-900: Run targeted checkout/deal/document/effect tests.
- [x] T-901: Run `bunx convex codegen`.
- [x] T-902: Run `bun check`.
- [x] T-903: Run `bun typecheck`.
- [x] T-904: Run broader `bun run test` if touched surfaces require it.
- [x] T-910: Run `$linear-pr-spec-audit`.
- [x] T-920: Resolve audit findings or record blockers.
- [x] T-921: Run parallel review aggregation with `$pr-review-toolkit`, `$caveman-review`, `$gitnexus-pr-review`, and `$superpowers:requesting-code-review`.
- [x] T-922: Resolve aggregated review findings around transfer conflicts, buyer conflicts, guest lawyer email normalization, replay locking, package failure journaling, and package fallback.
- [x] T-930: Run final execution artifact validation.
