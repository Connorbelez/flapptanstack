# Execution Checklist: ENG-343 - Deal closing: harden funds confirmation and close-side effects

## Requirements From Linear
- [x] Define a shared `FundsReceiptSource` contract for `transfer_pipeline` and `manual_admin` evidence, including pipeline id, leg 2 transfer id, provider code, admin actor, evidence note, received timestamp, and optional document asset attachments.
- [x] Add schema, validators, and helper functions for funds confirmation evidence, signed archive records, and close-side effect outcomes or exceptions with stable idempotency keys and queryable timestamps.
- [x] Replace `confirmFundsReceipt` with evidence validation and durable recording: provider-backed confirmation must verify a completed leg 2 seller payout for the same deal, and manual confirmation must require FairLend staff admin authority, actor, timestamp, evidence note, and optional attachments.
- [x] Reject or safely exception `FUNDS_RECEIVED` processing when evidence is missing, mismatched, duplicated with incompatible data, or attached to a cancelled/failed/non-funding deal.
- [x] Replace `archiveSignedDocuments` with signed artifact archive handling that consumes ENG-342 active completed envelope attempt/artifact state; missing artifacts must create a visible exception instead of silent success.
- [x] Preserve the governed transition contract: all status changes go through `executeTransition`, and provider/admin paths carry auditable source metadata.
- [x] Preserve and test idempotency for reservation commit, proration entries, payment reroute creation, and lawyer access revocation on retries or duplicate provider events.
- [x] Extend admin/internal deal projections to expose funds source, signed archive status, close effect outcomes, and blocking exceptions for ENG-346.
- [x] Expose a participant-safe close receipt summary for ENG-348 that excludes admin-only operational details while proving close completion.
- [x] Add targeted Convex tests for manual funds evidence, provider-backed leg 2 evidence, duplicate/out-of-order provider events, missing signed artifacts, partial close retries, cancelled/failed deal protection, and projection visibility.
- [x] Keep all exported Convex functions on fluent builders with explicit `.public()` or `.internal()` visibility and avoid `any` unless isolated and justified.

## Definition Of Done From Linear
- [x] `confirmFundsReceipt` is no longer a silent stub for production paths and records durable funds evidence or an explicit safe exception.
- [x] `archiveSignedDocuments` is no longer a silent stub when signed artifacts exist and records archive success or a visible archive blocker when artifacts are missing.
- [x] Provider-backed `FUNDS_RECEIVED` is tied to confirmed transfer-pipeline evidence for the same deal, especially leg 2 seller payout completion.
- [x] Manual admin confirmation requires FairLend staff admin authority plus actor, received timestamp, evidence note, and optional document asset attachments.
- [x] Duplicate, late, and out-of-order provider events do not duplicate transition emissions, reservation commits, prorate entries, reroutes, archive records, evidence records, or access revocations.
- [x] Cancelled/failed deals cannot be advanced by provider events or manual confirmation.
- [x] Close-side effect outcomes and blockers are queryable for admin operations, and participant-safe close receipt evidence is available for downstream buyer/seller workspaces.
- [x] Existing reservation, ledger, prorate, reroute, transfer pipeline, and access cleanup tests continue to pass, with new focused tests covering this issue's evidence and archive paths.
- [x] Implementation follows the published Notion plan.
- [x] Implementation worktree runs GitNexus impact before editing shared symbols and runs `bunx convex codegen`, `bun check`, `bun typecheck`, targeted close/transfer tests, `bun run test`, and `bun run review` before completion.

## Acceptance Criteria From Source Docs
- [x] Lock can reserve shares and collect locking fees; cancel can void reservations; funds receipt can commit, prorate, reroute, and revoke access.
- [x] `DEAL_LOCKED` can reserve shares and initiate locking fee collection when configured.
- [x] `DEAL_CANCELLED` can void a pending reservation and revoke active deal access.
- [x] `FUNDS_RECEIVED` transitions the deal to `confirmed` and triggers close-side effects, including reservation commit, accrual proration, payment reroute creation, and lawyer access revocation.
- [x] Effects are idempotent or fail safely when prerequisite data is missing.
- [x] Production readiness replaces or hardens the current funds-confirmation and signed-archive stubs; a logged placeholder is not sufficient for close completion.
- [x] `FUNDS_RECEIVED` is backed by either verified transfer-pipeline evidence or an auditable admin confirmation payload, and the chosen source is visible in the operations console.
- [x] Late, duplicate, or out-of-order provider events do not commit a reservation twice or advance a cancelled or failed deal.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit and Convex tests added or updated for backend/domain evidence, archive, outcomes, queries, validators, and transition paths.
- [x] E2E tests added or updated where a real operator/user workflow changed, or explicitly recorded as not applicable because this slice exposes backend contracts only.
  - Not applicable: this slice adds backend contracts and projections, with no new UI workflow.
- [x] Storybook stories added or updated where reusable UI changed, or explicitly recorded as not applicable because no UI components changed.
  - Not applicable: no reusable UI components changed.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] Required quality gates passed.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
