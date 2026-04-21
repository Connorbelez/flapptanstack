# Execution Checklist: ENG-308 - Lender portfolio: establish command-center contracts and source-of-truth rules

## Requirements From Linear
- [x] No public portfolio read accepts `lenderId`, email, or any other client-supplied lender identity.
- [x] Command-center reads are empty-state-safe and return stable shapes even when the lender has zero active positions.
- [x] Ownership math stays ledger-based with `10_000` units as 100% ownership and `1_000` units as one fraction.
- [x] The positions table contract returns property, thumbnail, mortgage status, fraction or position amount, renewal timing, next payment date, and payment amount without route-local recomputation.
- [x] The payment activity contract returns individual payment rows rather than aggregated rollups.
- [x] The action-required contract supports renewal prompts, payment exceptions, and deal-action items for the sticky rail.
- [x] The limits-strip contract exposes broker-imposed constraints plus the data needed by the bottom suggestions section.
- [x] The command-center contract exposes sheet-ready detail payloads for the approved full-height position and payment sheets.
- [x] Suggested opportunities are returned as ordered, server-owned DTOs with explanation tags and already-owned exclusion already applied.
- [x] Broker coordination context exposes assigned broker identity, availability state, fallback contact CTA data, optional thread id, and prefill context payloads.
- [x] The financial seam is explicit per surface for cockpit metrics and charts, payment activity rows, historical chart inputs, and CSV tax export inputs.
- [x] Broker coordination context is provided for the rail surface without building a full chat system in this issue.

## Definition Of Done From Linear
- [x] Stable command-center contracts exist under a dedicated portfolio module.
- [x] No public read accepts client-supplied lender identity.
- [x] Cockpit, ledgers, rail, sheets, and suggestions all have explicit DTOs.
- [x] Individual payment rows are first-class in the contract.
- [x] Suggested opportunities are returned ordered with explanation tags already applied.
- [x] Broker coordination context is explicit enough for `ENG-329` without implying a generalized chat platform.
- [x] Repo validation commands pass.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests are added under `convex/portfolio/__tests__/queries.test.ts` for empty-state, unauthorized, mid-period ownership, ordered suggestions, broker context, and individual payment-row behavior.
  Coverage note: ownership math is asserted in the portfolio query suite and reinforced by the focused accrual and ledger suites run in validation.
- [x] Existing backend seam tests are updated only if shared ledger, accrual, or listing behavior changes materially while extracting reusable helpers.
  Coverage note: the existing lender portal listing suite was rerun after extracting `convex/listings/lenderConstraints.ts`.
- [x] E2E coverage remains out of scope unless ENG-308 expands into route or component changes.
- [x] Storybook remains out of scope because ENG-308 is a backend contract slice with no reusable UI ownership.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] Required quality gates passed.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
