# Tasks: ENG-350 - Listing detail: enable hosted checkout launch UI

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Gather Linear issue, comments, labels, attached implementation plan, and supporting PRD context.
- [x] T-002: Run GitNexus indexing and impact analysis for planned existing-symbol edits.
- [x] T-003: Validate execution artifacts for `ready-to-edit`.

## Phase 2: Backend DTO Contract
- [x] T-010: Extend `convex/listings/marketplace.ts` detail response with checkout eligibility, server lock-fee copy, fraction bounds, and placeholder platform lawyer options only when production-backed and available.
- [x] T-011: Extend listing detail UI types and `buildMarketplaceListingDetailModel` to map the server checkout DTO without client-side authority fields.
- [x] T-012: Run `bunx convex codegen` if generated API types need refresh.

## Phase 3: Checkout Launcher UI
- [x] T-020: Replace production interactive checkout card flow in `ListingDetailPage` with hosted checkout launcher state.
- [x] T-021: Implement platform lawyer and guest lawyer snapshot selection with accessible controls and validation.
- [x] T-022: Implement fraction controls with server-derived min/max, duplicate-submit guard, backend failure rendering, and hosted URL redirect.
- [x] T-023: Preserve read-only/demo/ineligible listing messaging without enabling checkout submission.

## Phase 4: Route And Return States
- [x] T-030: Pass listing route search/query state into `MarketplaceListingDetailPage` without breaking the auth wrapper pattern.
- [x] T-031: Render success/pending, canceled/abandoned, expired, provider failure, and generic error states from internal checkout state/search context where available.

## Phase 5: Tests
- [x] T-040: Update marketplace adapter/page tests for eligible and ineligible checkout DTO behavior.
- [x] T-041: Add RTL coverage for launcher validation, disabled/read-only states, successful redirect, backend errors, and double submit.
- [x] T-042: Update route tests for auth wrapper/search behavior if route code changes.
- [x] T-043: Record E2E and Storybook applicability decisions.

## Phase 9: Validation And Audit
- [x] T-900: Run required quality gates and targeted tests.
- [x] T-910: Run `$linear-pr-spec-audit`.
- [x] T-920: Resolve audit findings or record blockers.
- [x] T-930: Run final execution artifact validation and `gitnexus_detect_changes` equivalent.
