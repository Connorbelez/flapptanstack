# Execution Status: ENG-341 - Deal closing: create deals from verified listing-lock checkout

- Overall status: partial
- Current phase: validation and audit
- Current chunk: chunk-06-validation-audit
- Last updated: 2026-04-24T20:53:30Z

## Active focus
- ENG-341 implementation is complete and targeted validation is passing.

## Blockers
- Repo-wide `bun run test` fails in unrelated existing areas recorded in `audit.md`; ENG-341 targeted tests pass.

## Notes
- Linear issue includes managed requirements and definition of done.
- Primary Notion implementation plan is present and Codex-ready.
- ENG-338 participant/access/fraction projection is already present in this worktree (`convex/deals/participantProjection.ts`) and should be consumed rather than reimplemented.
- GitNexus analysis completed for this worktree on 2026-04-24. Initial impact checks for `ListingDetailPage`, `collectLockingFee`, `stripeWebhook`, and `getMarketplaceListingDetail` returned LOW risk with no upstream callers. `reserveShares` and `transitionDeal` are findable by GitNexus context but ambiguous for the impact command, so edits to those symbols remain treated as medium operational risk because they touch money movement and governed status transitions.
- `scripts/validate_execution_artifacts.py ENG-341 --stage ready-to-edit` passed.
- Chunk 01 completed: validators, schema, additive deal metadata, and `bunx convex codegen` passed after `bun install`.
- Chunk 02 completed: checkout start action/mutation split, reservation/session creation, failure/expiry cleanup, and targeted checkout tests passed.
- Chunk 03 completed: verified Stripe checkout success creates exactly one governed locked deal and handles duplicate, late, terminal, and unknown events.
- Chunk 04 completed: deal effects reconcile pre-created reservations and externally collected Stripe lock fees.
- Chunk 05 completed: marketplace detail exposes checkout only when provider config, available fractions, and lawyer options are present, and redirects through the checkout action.
- Chunk 06 completed with external blocker: codegen/check/typecheck/targeted tests/review/spec audit pass; repo-wide test suite fails outside ENG-341 scope.
