# Chunk Context: chunk-01-schema-evidence

## Goal
- Establish the durable data contracts for close evidence before changing transition behavior.

## Relevant plan excerpts
- `FUNDS_RECEIVED` must be backed by verified transfer-pipeline evidence or explicit auditable admin evidence.
- Add schema/validators/helpers for funds confirmation evidence, signed archive records, and close-side effect outcomes or exceptions with idempotency keys and queryable timestamps.
- Missing signed artifacts must create a visible exception instead of silent success.

## Implementation notes
- Expected schema touchpoint: `convex/schema.ts`.
- Expected helper module: `convex/deals/closeEvidence.ts` or equivalent.
- `FundsReceiptSource` has two variants: `transfer_pipeline` and `manual_admin`.
- Evidence replay must be compatible only when the idempotency key and payload match.
- Participant receipt projection must hide admin-only manual evidence details.

## Existing code touchpoints
- `confirmFundsReceipt` and `archiveSignedDocuments` live in `convex/engine/effects/dealClosingEffects.ts`.
- `handlePipelineLegConfirmed` currently schedules `FUNDS_RECEIVED` after leg 2 seller payout confirmation.
- GitNexus analyze must complete before impact checks and edits.

## Validation
- `python3 scripts/validate_execution_artifacts.py ENG-343 --repo-root "/Users/connor/.codex/worktrees/e56c/fairlendapp" --stage ready-to-edit`
- GitNexus impact for planned touched symbols before implementation.
- Targeted tests will be added in later chunks once code paths exist.
