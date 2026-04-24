# Execution Checklist: ENG-303 - Broker landing page: define the v1 production portal template contract

## Requirements From Linear
- [x] Introduce one explicit public landing-page contract that combines portal identity, broker identity, teaser listing data, CTA copy, and financing-strip copy into a single read model.
- [x] Reuse `portalContext` and persisted portal rows as the source of structural host data; do not re-resolve hosts in leaf consumers.
- [x] Reuse live broker data for brokerage name and licensing wherever possible.
- [x] Add only the minimal optional content fields required for the approved v1 IA when values cannot be derived from existing runtime data.
- [x] Make the contract work for both the FairLend `app` portal and broker portals without separate renderer shapes.
- [x] Include contract fields for top navigation labels and destinations, hero copy, trust-strip items, lender CTA copy, borrower or mortgage-applicant CTA copy, nested pre-approval action labels, featured-listing teaser metadata, and inline financing-strip labels.
- [x] Keep featured-listing data aligned to the live listing runtime and portal pricing projection instead of inventing a teaser-only listing model.
- [x] Define deterministic fallbacks so missing optional content never breaks root rendering.
- [x] Keep pre-approval nested inside the financing side in the contract shape; never expose it as a required third peer block.
- [x] Avoid importing demo state, demo stores, or mock-data shapes into the production contract.
- [x] Document which fields are structural runtime dependencies versus optional presentation copy.
- [x] Leave generalized theming, arbitrary blocks, and self-serve authoring out of scope.

## Definition Of Done From Linear
- [x] An implementation agent can read one landing-page contract and render the approved v1 IA without rediscovering portal, broker, or teaser-listing assumptions.
- [x] The contract composes cleanly with root `portalContext`, live broker data, and live portal-aware listing projection.
- [x] Minimal optional copy fields are defined only where current repo data is insufficient.
- [x] The FairLend `app` portal and broker portals share the same contract shape.
- [x] The contract explicitly preserves lender vs borrower or mortgage-applicant as the top-level split with nested pre-approval.
- [x] The teaser portion is defined against the real listing runtime rather than demo data.
- [x] The contract avoids reopening CMS and theming scope.
- [x] `ENG-305`, `ENG-306`, and `ENG-307` can proceed using this contract without needing another planning pass.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated for backend contract shaping, fallback behavior, and teaser projection.
- [x] E2E tests added or updated where an operator or user workflow changed.
  - Expected inapplicable for ENG-303 because this issue defines a backend/frontend type contract, not a rendered user workflow.
- [x] Storybook stories added or updated where reusable UI changed.
  - Expected inapplicable for ENG-303 because no reusable visual component or screen is introduced.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] Required quality gates passed: `bunx convex codegen`, `bun check`, `bun typecheck`, targeted tests.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
